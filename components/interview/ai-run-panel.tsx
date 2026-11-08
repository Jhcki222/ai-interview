import { ArrowRightLeft, Check, CircleAlert, RotateCw, Sparkles } from "lucide-react";
import { modelDisplayName, type Selection } from "@/lib/ai/catalog";
import type { HarnessEvent } from "@/lib/ai/harness/events";
import type { AIStatus } from "@/lib/ai/reliability";

const actions = {
  analyze: "문서 분석",
  generate: "면접 질문 생성",
  evaluate: "답변 평가",
  followup: "꼬리질문 생성",
  summary: "종합 피드백",
};
const providers: Record<string, string> = {
  groq: "Groq",
  nvidia: "NVIDIA",
  ollama: "Ollama Cloud",
  openai: "OpenAI",
};
const stages = ["모델 연결", "응답 생성", "결과 검증"];
const stageIndex: Partial<Record<AIStatus["state"] | HarnessEvent["stage"], number>> = {
  processing: 1,
  validating: 2,
  completed: 3,
};
const failureLabels: Partial<Record<AIStatus["state"], string>> = {
  timeout: "시간 초과",
  ratelimit: "요청 한도 도달",
  missingconfig: "연결 설정 필요",
  failed: "실행 실패",
};
const reasons: Record<string, string> = {
  AUTH_ERROR: "제공자 인증 실패",
  RATE_LIMIT: "요청 한도 도달",
  MODEL_UNAVAILABLE: "모델 사용 불가",
  TIMEOUT: "응답 시간 초과",
  INVALID_RESPONSE: "응답 형식 오류",
  PROVIDER_UNAVAILABLE: "제공자 일시 오류",
  PROVIDER_REQUEST: "제공자 요청 오류",
  NETWORK_ERROR: "연결 오류",
};

function formatDuration(seconds: number) {
  const whole = Math.floor(seconds);
  return whole < 60 ? `${whole}초` : `${Math.floor(whole / 60)}분 ${whole % 60}초`;
}

export function AiRunPanel({
  status,
  events,
  selection,
  busy,
  elapsed,
  onCancel,
}: {
  status: AIStatus;
  events: HarnessEvent[];
  selection: Selection;
  busy: boolean;
  elapsed: number;
  onCancel: () => void;
}) {
  const latest = events.at(-1);
  const completed = status.state === "completed";
  const stopped = !busy && !completed;
  const cancelled = status.state === "cancelled";
  const outcome = completed ? "complete" : stopped ? (cancelled ? "cancelled" : "error") : "active";
  const previousStage = events.findLast(
    (event) =>
      event.stage === "connecting" || event.stage === "processing" || event.stage === "validating",
  )?.stage;
  const current = stopped
    ? (stageIndex[previousStage ?? "connecting"] ?? 0)
    : (stageIndex[status.state] ?? 0);
  const stateLabel = completed
    ? "완료"
    : stopped
      ? cancelled
        ? "취소됨"
        : (failureLabels[status.state] ?? "실행 실패")
      : "진행 중";
  const model = status.model ?? latest?.model ?? selection.model;
  const provider = status.provider ?? latest?.provider ?? selection.provider;
  const changes = events.filter(
    (event) => event.stage === "fallback" || event.stage === "retrying",
  );
  const runId = status.correlationId ?? latest?.runId;
  const duration =
    busy && !completed ? elapsed : (status.elapsedMs ?? latest?.elapsedMs ?? elapsed * 1000) / 1000;
  const hasError = stopped && !cancelled;

  return (
    <section className="ai-run" data-outcome={outcome} aria-label="AI 실행 상태">
      <header className="ai-run-header">
        <span className="ai-run-icon" aria-hidden="true">
          {completed ? (
            <Check size={18} />
          ) : hasError ? (
            <CircleAlert size={18} />
          ) : (
            <Sparkles size={18} />
          )}
        </span>
        <div className="ai-run-title">
          <div className="ai-run-heading">
            <strong>{latest ? actions[latest.action] : "AI 요청"}</strong>
            <span className="ai-run-badge" role="status">
              {outcome === "active" && <i className="ai-run-pulse" aria-hidden="true" />}
              {stateLabel}
              {outcome === "active" && <span className="sr-only"> · {stages[current]}</span>}
            </span>
          </div>
          <div className="ai-run-model" title={model}>
            <span>{providers[provider] ?? provider}</span>
            <strong>{modelDisplayName(model)}</strong>
          </div>
        </div>
        <div className="ai-run-actions">
          <span className="ai-run-time">{formatDuration(duration)}</span>
          {busy && !completed && (
            <button type="button" className="btn btn-secondary ai-run-cancel" onClick={onCancel}>
              취소
            </button>
          )}
        </div>
      </header>

      <ol className="ai-run-stages" aria-label="실행 단계">
        {stages.map((stage, index) => (
          <li
            key={stage}
            data-stage={index < current ? "done" : index === current ? outcome : "waiting"}
            aria-current={index === current && !stopped ? "step" : undefined}
          >
            <span className="ai-run-stage-marker" aria-hidden="true">
              {index < current ? <Check size={12} /> : index + 1}
            </span>
            {stage}
          </li>
        ))}
      </ol>

      {changes.length > 0 && (
        <ul className="ai-run-changes" aria-label="재시도 및 모델 전환">
          {changes.map((event) => (
            <li key={event.sequence}>
              {event.stage === "fallback" ? (
                <ArrowRightLeft size={14} aria-hidden="true" />
              ) : (
                <RotateCw size={14} aria-hidden="true" />
              )}
              <span>
                <strong>{event.stage === "fallback" ? "모델 전환" : "재시도"}</strong>
                {event.model && (
                  <>
                    {" "}
                    · {providers[event.provider ?? ""]} {modelDisplayName(event.model)}
                  </>
                )}
                {event.code && reasons[event.code] && <> · {reasons[event.code]}</>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasError && runId && (
        <details className="ai-run-details">
          <summary>오류 정보</summary>
          <small>
            요청 ID <code>{runId}</code>
          </small>
        </details>
      )}
    </section>
  );
}
