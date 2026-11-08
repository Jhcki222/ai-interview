import asyncio
import json
import unittest
from unittest.mock import patch
from uuid import uuid4

import httpx
from pydantic import ValidationError

from python_harness.app import RunStream, app, stream
from python_harness.contracts import AgentContext, Evaluation, Followup, Generation, RunRequest, Selection
from python_harness.providers import Failure, Providers, retry_after
from python_harness.runtime import execute_tool, route_interview, run_harness

GROQ = Selection(provider="groq", model="openai/gpt-oss-20b")
NVIDIA = Selection(provider="nvidia", model="nvidia/nemotron-3-ultra-550b-a55b")
TOKEN = "synthetic-test-token-" * 2
OUTPUT = {"question": "어떻게 검증했나요?", "reason": "검증 근거 확인", "modelAnswer": "재현 조건을 설명합니다."}


def request(**input_overrides):
    return RunRequest.model_validate({
        "runId": uuid4(),
        "budgetMs": 10000,
        "input": {
            "action": "followup", "question": "비공개질문", "answer": "비공개답변",
            "selection": GROQ.model_dump(), "allowFallback": False, **input_overrides,
        },
    })


def question(index):
    return {
        "id": str(index), "category": "CS", "subcategory": "네트워크", "topic": "HTTP",
        "difficulty": "BASIC", "importance": "ESSENTIAL", "question": f"질문 {index}",
        "modelAnswer": {
            "summary": "요약", "interviewAnswer": "답변", "detailedExplanation": "설명",
            "example": "예제", "keywords": ["HTTP"],
        },
        "followUps": [
            {"id": str(followup), "question": "이유는?", "modelAnswer": "근거"}
            for followup in range(2)
        ],
        "source": {"type": "document", "evidence": "원문 근거"},
    }


class DecisionTests(unittest.TestCase):
    def test_route_boundaries(self):
        for score, overrides, expected in [
            (69, {}, "followup"), (70, {}, "next"),
            (69, {"followupCount": 2}, "next"),
            (70, {"questionIndex": 4}, "finish"),
            (0, {"turnCount": 44}, "finish"),
        ]:
            with self.subTest(score=score, overrides=overrides):
                evaluation = Evaluation.model_validate({
                    "score": score, "strengths": ["강점"], "improvements": ["개선"], "revisedAnswer": "예시",
                    "dimensions": [
                        {"name": name, "score": score, "evidence": "근거"}
                        for name in ("정확성", "논리성", "구체성", "질문 적합성", "실무 적용성")
                    ],
                })
                context = AgentContext.model_validate({
                    **{"questionIndex": 0, "questionCount": 5, "followupCount": 0, "turnCount": 1},
                    **overrides,
                })
                decision = route_interview(evaluation, context)
                self.assertEqual(decision["action"], expected)
                self.assertEqual(decision["focus"], "정확성")
                self.assertEqual(decision["trace"][-1]["node"], "await_confirmation")

    def test_rejects_duplicate_dimensions_and_invalid_context(self):
        with self.assertRaises(ValidationError):
            Evaluation.model_validate({
                "score": 50, "strengths": ["강점"], "improvements": ["개선"], "revisedAnswer": "예시",
                "dimensions": [{"name": "정확성", "score": 50, "evidence": "근거"}] * 5,
            })
        with self.assertRaises(ValidationError):
            AgentContext(questionIndex=5, questionCount=5, followupCount=0, turnCount=1)


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_retry_and_fallback_only_when_enabled(self):
        for consent, expected in [(False, ["groq", "groq"]), (True, ["groq", "groq", "nvidia"])]:
            calls = []
            events = []

            class Stub:
                async def complete(self, selection, *args):
                    calls.append(selection.provider)
                    if selection == GROQ:
                        raise Failure("RATE_LIMIT", 0)
                    return Followup.model_validate(OUTPUT)

            await run_harness(
                request(allowFallback=consent), [GROQ, NVIDIA], Stub(),
                lambda name, payload: events.append((name, payload)),
            )
            self.assertEqual(calls, expected)
            self.assertEqual(events[-1][0], "complete" if consent else "error")
            traces = [payload for name, payload in events if name == "harness"]
            self.assertEqual([event["sequence"] for event in traces], list(range(1, len(traces) + 1)))
            self.assertNotIn("비공개", json.dumps(traces, ensure_ascii=False))

    async def test_budget_and_non_retryable_errors(self):
        for code, delay, expected in [
            ("AUTH_ERROR", None, ["groq", "nvidia"]),
            ("INVALID_RESPONSE", None, ["groq", "nvidia"]),
            ("RATE_LIMIT", 60, ["groq", "nvidia"]),
        ]:
            calls = []

            class Stub:
                async def complete(self, selection, *args):
                    calls.append(selection.provider)
                    raise Failure(code, delay)

            events = []
            await run_harness(
                request(allowFallback=True), [GROQ, NVIDIA], Stub(),
                lambda name, payload: events.append((name, payload)),
            )
            self.assertEqual(calls, expected)
            self.assertEqual(events[-1][1]["code"], code)

    async def test_exhausted_budget_skips_provider(self):
        with patch("python_harness.runtime.execute_tool") as tool:
            events = []
            run = request().model_copy(update={"budgetMs": 1})
            await run_harness(run, [GROQ], object(), lambda name, data: events.append((name, data)))
            tool.assert_not_called()
        self.assertEqual(events[-1][1]["code"], "TIMEOUT")

    async def test_stream_close_cancels_inflight_provider(self):
        started = asyncio.Event()
        stopped = asyncio.Event()

        class Stub:
            async def complete(self, *args):
                started.set()
                try:
                    await asyncio.Future()
                finally:
                    stopped.set()

        async def send(message):
            if message["type"] == "http.response.body":
                await asyncio.wait_for(started.wait(), timeout=1)
                raise OSError("Client disconnected")

        async def receive():
            return {"type": "http.disconnect"}

        from starlette.requests import ClientDisconnect

        response = RunStream(stream(request(allowFallback=True), [GROQ, NVIDIA], Stub()))
        with self.assertRaises(ClientDisconnect):
            await response({"type": "http", "asgi": {"spec_version": "2.4"}}, receive, send)
        self.assertTrue(stopped.is_set())

    async def test_generation_merges_batches_in_plan_order(self):
        class Stub:
            async def complete(self, selection, action, prompt, run_id, batch):
                if batch == 1:
                    await asyncio.sleep(0.01)
                self.last_prompt = prompt
                return Generation.model_validate({"questions": [question(i) for i in range(5)]})

        stub = Stub()
        input = self.generation_request().input
        output = await execute_tool(stub, input, GROQ, str(uuid4()))
        self.assertEqual(len(output.questions), 15)
        self.assertEqual([output.questions[i].id for i in (0, 5, 10)], ["batch-1-0", "batch-2-0", "batch-3-0"])
        self.assertIn('"count":5', stub.last_prompt)

    async def test_invalid_batch_cancels_sibling_and_fails_atomically(self):
        pending = asyncio.Event()
        cancelled = asyncio.Event()

        class Stub:
            async def complete(self, selection, action, prompt, run_id, batch):
                if batch == 1:
                    await pending.wait()
                    return Generation.model_validate({"questions": [question(0)] * 5})
                pending.set()
                try:
                    await asyncio.Future()
                finally:
                    cancelled.set()

        with self.assertRaisesRegex(Failure, "INVALID_RESPONSE"):
            await execute_tool(Stub(), self.generation_request(10).input, GROQ, str(uuid4()))
        self.assertTrue(cancelled.is_set())

    @staticmethod
    def generation_request(count=15):
        return RunRequest.model_validate({
            "runId": uuid4(), "budgetMs": 10000,
            "input": {
                "action": "generate", "selection": GROQ.model_dump(),
                "settings": {"role": "백엔드", "level": "신입", "count": count, "mode": "chat"},
                "analysis": {"summary": "HTTP 학습", "skills": [], "experiences": [], "uncertainties": []},
            },
        })


class EndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_catalog_and_run_replay_without_network(self):
        calls = []

        def handler(req):
            calls.append(req)
            return httpx.Response(
                200, json={
                    "x_groq": {"id": "req_fixture"},
                    "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(OUTPUT)}}],
                },
            )

        env = {
            "AI_HARNESS_TOKEN": TOKEN, "GROQ_API_KEY": "fake-provider-key",
            "NVIDIA_API_KEY": "", "OLLAMA_API_KEY": "", "OPENAI_API_KEY": "",
        }
        with patch.dict("os.environ", env):
            async with app.router.lifespan_context(app):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as provider:
                    app.state.providers.client = provider
                    await self.replay(calls)

    async def replay(self, calls):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app), base_url="http://fixture"
        ) as client:
            headers = {"Authorization": f"Bearer {TOKEN}"}
            payload = request().model_dump(mode="json")
            self.assertEqual((await client.get("/healthz")).status_code, 200)
            self.assertEqual((await client.post("/v1/runs", json=payload)).status_code, 401)
            self.assertIn("groq", [item["provider"] for item in (await client.get("/v1/catalog", headers=headers)).json()])
            self.assertEqual((await client.post("/v1/runs", headers=headers, content="x" * 221001)).status_code, 413)
            invalid = request(selection={"provider": "groq", "model": "https://untrusted.example"})
            self.assertEqual((await client.post("/v1/runs", headers=headers, json=invalid.model_dump(mode="json"))).status_code, 400)
            self.assertEqual((await client.post("/v1/runs", headers=headers, json={"input": {"action": "unknown"}})).status_code, 400)
            with self.assertLogs("uvicorn.error", level="INFO") as logs:
                response = await client.post("/v1/runs", headers=headers, json=payload)
            self.assertEqual(response.status_code, 200)
            self.assertIn("event: complete", response.text)
            self.assertNotIn("비공개", response.text)
            self.assertEqual(len(calls), 1)
            self.assertEqual(calls[0].url.host, "api.groq.com")
            self.assertIn("req_fixture", "\n".join(logs.output))
            self.assertIn(payload["runId"], "\n".join(logs.output))
            self.assertNotIn("비공개", "\n".join(logs.output))
            self.assertNotIn("fake-provider-key", "\n".join(logs.output))


class ProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_nvidia_transport_and_malformed_output(self):
        def handler(req):
            payload = json.loads(req.content)
            self.assertEqual(payload["chat_template_kwargs"], {"enable_thinking": False})
            self.assertEqual(payload["response_format"], {"type": "json_object"})
            return httpx.Response(200, json={
                "choices": [{"finish_reason": "stop", "message": {"content": '{"question":false}'}}],
            })

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with patch.dict("os.environ", {"NVIDIA_API_KEY": "fake"}):
                with self.assertRaisesRegex(Failure, "INVALID_RESPONSE"):
                    await Providers(client).complete(NVIDIA, "followup", "synthetic", str(uuid4()), 1)

    def test_retry_after(self):
        self.assertEqual(retry_after("2"), 2)
        self.assertEqual(retry_after("broken"), 1)
        self.assertEqual(retry_after("999999"), 3600)


if __name__ == "__main__":
    unittest.main()
