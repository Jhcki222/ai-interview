"""Budgeted execution, validation, and deterministic interview routing."""

import asyncio
import json
import logging
from time import monotonic
from typing import Callable

from .contracts import (
    AgentContext, AnalyzeRequest, EvaluateRequest, Evaluation, GenerateRequest,
    Generation, InterviewRequest, RunRequest, Selection, TOOLS,
)
from .prompts import INSTRUCTIONS
from .providers import Failure, Providers

LOG = logging.getLogger("uvicorn.error")
BATCH_FOCUS = ("핵심 개념과 대표 경험", "문제 해결 과정과 협업", "실무 적용과 판단 근거")
Emit = Callable[[str, dict], None]


def build_prompt(input: InterviewRequest, extra: str = ""):
    data = input.model_dump(exclude_none=True, exclude={"selection", "allowFallback", "agentContext"})
    targeting = ""
    if isinstance(input, (AnalyzeRequest, GenerateRequest)):
        targeting = (
            "settings의 산업·기관 유형, 지원 기업, 부문, 직무, 경력, 면접 유형, 난이도를 반영하라. "
            "채용 공고는 jobPosting에 실제로 명시된 요구만 활용하라. 기업 사실을 지어내지 마라."
        )
    output, _ = TOOLS[input.action]
    schema = json.dumps(output.model_json_schema(), ensure_ascii=False, separators=(",", ":"))
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return (
        f"{targeting}\n{INSTRUCTIONS[input.action]}\n{extra}\n"
        f"반드시 아래 JSON Schema에 맞는 JSON 객체만 반환하라.\n{schema}\n입력 데이터(JSON):\n{payload}"
    )


def route_interview(evaluation: Evaluation, context: AgentContext):
    weakest = min(evaluation.dimensions, key=lambda dimension: dimension.score)
    if context.turnCount >= 44:
        action, reason = "finish", "전체 면접 턴 한도에 도달해 종합 평가로 이동합니다."
    elif weakest.score < 70 and context.followupCount < 2:
        action = "followup"
        reason = f"{weakest.name} 평가가 {weakest.score:g}점으로, 이 부분의 근거를 더 확인할 꼬리질문을 제안합니다."
    elif context.questionIndex >= context.questionCount - 1:
        action, reason = "finish", "마지막 질문의 평가를 마쳤습니다. 전체 답변을 종합해 학습 계획을 정리합니다."
    else:
        action = "next"
        reason = (
            "이 질문의 꼬리질문 2회를 모두 사용했습니다. 다음 주제로 이동합니다."
            if context.followupCount >= 2
            else "모든 평가 영역이 70점 이상입니다. 다른 주제로 넘어가 역량을 확인합니다."
        )
    return {
        "version": 1, "action": action, "reason": reason, "focus": weakest.name,
        "trace": [
            {"node": "evaluate", "detail": "현재 답변을 다섯 영역으로 평가했습니다."},
            {"node": "validate", "detail": "점수 범위·평가 영역 중복·응답 형식을 검증했습니다."},
            {"node": "route", "detail": reason},
            {"node": "await_confirmation", "detail": "사용자의 확인 후 다음 도구를 실행합니다."},
        ],
    }


async def execute_tool(providers: Providers, input: InterviewRequest, selection: Selection, run_id: str):
    if not isinstance(input, GenerateRequest):
        return await providers.complete(selection, input.action, build_prompt(input), run_id, 1)

    total = input.settings.count // 5
    batch_input = input.model_copy(update={"settings": input.settings.model_copy(update={"count": 5})})

    async def generate_batch(index: int):
        extra = (
            f"전체 {total}묶음 중 {index + 1}번째다. 중점은 {BATCH_FOCUS[index]}다. "
            "면접 유형을 유지하고 다른 묶음과 겹치지 않는 관점으로 정확히 5개 질문을 작성하라."
        )
        output = await providers.complete(selection, "generate", build_prompt(batch_input, extra), run_id, index + 1)
        if len(output.questions) != 5 or len({question.id for question in output.questions}) != 5:
            raise Failure("INVALID_RESPONSE")
        return output.questions

    tasks = [asyncio.create_task(generate_batch(index)) for index in range(total)]
    try:
        batches = await asyncio.gather(*tasks)
    finally:
        # A failed or cancelled attempt cannot leave another batch running.
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    questions = [
        question if total == 1 else question.model_copy(
            update={"id": f"batch-{index + 1}-{question.id}"[:100]}
        )
        for index, batch in enumerate(batches)
        for question in batch
    ]
    if len({question.id for question in questions}) != input.settings.count:
        raise Failure("INVALID_RESPONSE")
    return Generation(questions=questions)


class RunEvents:
    def __init__(self, request: RunRequest, emit: Emit):
        self.run_id = str(request.runId)
        self.action = request.input.action
        self.emit = emit
        self.started = monotonic()
        self.sequence = 0

    def stage(self, stage, selection=None, code=None):
        self.sequence += 1
        payload = {
            "version": "interview-harness-v1", "runId": self.run_id,
            "sequence": self.sequence, "action": self.action, "stage": stage,
            "elapsedMs": int((monotonic() - self.started) * 1000),
        }
        if selection:
            payload.update(selection.model_dump())
        if code:
            payload["code"] = code
        LOG.info("harness_event %s", json.dumps(payload, separators=(",", ":")))
        self.emit("harness", payload)
        return payload

    def status(self, stage, selection, message, **extra):
        payload = self.stage(stage, selection, extra.get("code"))
        self.emit("status", {
            **selection.model_dump(), "state": stage, "message": message,
            "correlationId": self.run_id, "elapsedMs": payload["elapsedMs"], **extra,
        })


async def run_harness(request: RunRequest, candidates: list[Selection], providers: Providers, emit: Emit):
    events = RunEvents(request, emit)
    input = request.input
    deadline = events.started + request.budgetMs / 1000
    active = candidates[:3] if input.allowFallback else candidates[:1]
    last = Failure("MISSING_CONFIG")
    selection = None
    events.stage("accepted")
    try:
        for index, selection in enumerate(active):
            if index:
                events.status("fallback", selection, "허용한 대체 AI 제공자로 연결합니다.", code=last.code)
            for attempt in (1, 2):
                remaining = deadline - monotonic()
                if remaining < 1:
                    raise Failure("TIMEOUT")
                events.status("connecting", selection, "AI 제공자에 연결하고 있습니다.", attempt=attempt)
                events.status("processing", selection, "AI 응답을 생성하고 있습니다.")
                limit = 75 if input.action == "generate" and selection.provider == "nvidia" else 30
                try:
                    async with asyncio.timeout(min(limit, remaining)):
                        output = await execute_tool(providers, input, selection, events.run_id)
                except TimeoutError:
                    last = Failure("TIMEOUT")
                except Failure as failure:
                    last = failure
                else:
                    events.status("validating", selection, "검증된 응답을 정리하고 있습니다.")
                    result = output.model_dump()
                    if isinstance(input, EvaluateRequest) and input.agentContext:
                        result["agentDecision"] = route_interview(output, input.agentContext)
                    events.status("completed", selection, "응답 생성과 검증을 완료했습니다.")
                    emit("complete", result)
                    return
                delay = last.retry_after if last.retry_after is not None else 0.75
                if attempt == 2 or not last.retryable or delay > 8 or delay + 1 > deadline - monotonic():
                    break
                events.status(
                    "retrying", selection, last.message + " 잠시 후 한 번 재시도합니다.",
                    code=last.code, retryAfterMs=int(delay * 1000), attempt=2,
                )
                await asyncio.sleep(delay)
        raise last
    except asyncio.CancelledError:
        events.stage("cancelled", selection, "CANCELLED")
        raise
    except Exception as error:
        if not isinstance(error, Failure):
            LOG.error("harness_internal run=%s type=%s", events.run_id, type(error).__name__)
            error = Failure("INTERNAL_ERROR")
        payload = events.stage("failed", selection, error.code)
        details = {key: payload[key] for key in ("code", "elapsedMs", "provider", "model") if key in payload}
        if error.retry_after is not None:
            details["retryAfterMs"] = int(error.retry_after * 1000)
        emit("error", {"correlationId": events.run_id, "message": error.message, **details})
