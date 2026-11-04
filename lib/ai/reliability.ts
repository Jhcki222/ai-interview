import type { Selection } from "./catalog";
export type StatusCode =
  | "initializing"
  | "connecting"
  | "processing"
  | "validating"
  | "retrying"
  | "fallback"
  | "completed"
  | "timeout"
  | "ratelimit"
  | "missingconfig"
  | "failed"
  | "cancelled";
export type AIStatus = {
  state: StatusCode;
  message: string;
  provider?: string;
  model?: string;
  attempt?: number;
  elapsedMs?: number;
  code?: string;
  retryAfterMs?: number;
  correlationId?: string;
};
export type SafeFailure = {
  code: string;
  message: string;
  retryable: boolean;
  fallback: boolean;
  retryAfterMs?: number;
};
export class ProviderFailure extends Error {
  constructor(
    public detail: SafeFailure,
    public selection?: Selection,
  ) {
    super(detail.message);
  }
}
export function classifyProviderError(error: unknown): SafeFailure {
  const e = (error && typeof error === "object" ? error : {}) as {
    statusCode?: number;
    status?: number;
    name?: string;
    responseHeaders?: Record<string, string>;
    cause?: unknown;
  };
  const status = e.statusCode || e.status;
  if (status === 401 || status === 403)
    return {
      code: "AUTH_ERROR",
      message: "AI 제공자 인증 또는 접근 권한을 확인해 주세요.",
      retryable: false,
      fallback: true,
    };
  if (status === 429) {
    const raw = e.responseHeaders?.["retry-after"];
    const seconds = raw ? Number(raw) : NaN;
    const wait = Number.isFinite(seconds)
      ? Math.max(0, seconds * 1000)
      : raw
        ? Math.max(0, Date.parse(raw) - Date.now())
        : 1000;
    return {
      code: "RATE_LIMIT",
      message: "AI 제공자의 요청 한도에 도달했습니다.",
      retryable: true,
      fallback: true,
      retryAfterMs: Math.min(3600000, Number.isFinite(wait) ? wait : 1000),
    };
  }
  if (status === 404 || status === 410)
    return {
      code: "MODEL_UNAVAILABLE",
      message: "선택한 모델을 현재 제공자가 지원하지 않습니다.",
      retryable: false,
      fallback: true,
    };
  if (e.name === "TimeoutError")
    return {
      code: "TIMEOUT",
      message: "AI 제공자의 응답 제한 시간을 초과했습니다.",
      retryable: false,
      fallback: true,
    };
  if (e.name === "AbortError")
    return {
      code: "CANCELLED",
      message: "요청이 취소되었습니다.",
      retryable: false,
      fallback: false,
    };
  if (
    e.name === "ZodError" ||
    e.name === "AI_NoObjectGeneratedError" ||
    e.name === "AI_TypeValidationError"
  )
    return {
      code: "INVALID_RESPONSE",
      message: "AI 응답 형식 검증에 실패했습니다.",
      retryable: false,
      fallback: true,
    };
  if (status && status >= 500)
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: "AI 제공자 서비스가 일시적으로 응답하지 않습니다.",
      retryable: true,
      fallback: true,
    };
  if (status && status >= 400)
    return {
      code: "PROVIDER_REQUEST",
      message: "선택한 모델이 요청 형식을 처리하지 못했습니다.",
      retryable: false,
      fallback: true,
    };
  return {
    code: "NETWORK_ERROR",
    message: "AI 제공자 연결이 원활하지 않습니다.",
    retryable: true,
    fallback: true,
  };
}
export function waitWithSignal(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const done = () => {
      signal.removeEventListener("abort", cancel);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal.addEventListener("abort", cancel, { once: true });
  });
}
export async function runReliable<T>({
  candidates,
  allowFallback,
  signal,
  operation,
  onStatus,
  budgetMs = 100000,
  sleep = waitWithSignal,
  attemptTimeoutMs = () => 40000,
}: {
  candidates: Selection[];
  allowFallback: boolean;
  signal: AbortSignal;
  operation: (selection: Selection, signal: AbortSignal) => Promise<T>;
  onStatus: (status: AIStatus) => void;
  budgetMs?: number;
  attemptTimeoutMs?: (selection: Selection) => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}) {
  const started = Date.now();
  let last = new ProviderFailure({
    code: "MISSING_CONFIG",
    message: "사용 가능한 AI 제공자가 없습니다.",
    retryable: false,
    fallback: false,
  });
  const active = allowFallback ? candidates : candidates.slice(0, 1);
  for (let index = 0; index < active.length; index++) {
    const selection = active[index];
    if (index)
      onStatus({
        state: "fallback",
        message: last.detail.message + " 허용한 대체 AI 제공자로 연결합니다.",
        code: last.detail.code,
        ...selection,
        elapsedMs: Date.now() - started,
      });
    for (let retry = 0; retry <= 1; retry++) {
      signal.throwIfAborted();
      const remaining = budgetMs - (Date.now() - started);
      if (remaining < 1000)
        throw new ProviderFailure(
          {
            code: "TIMEOUT",
            message: "전체 AI 요청 제한 시간을 초과했습니다.",
            retryable: false,
            fallback: false,
          },
          selection,
        );
      onStatus({
        state: "connecting",
        message: "AI 제공자에 연결하고 있습니다.",
        ...selection,
        attempt: retry + 1,
        elapsedMs: Date.now() - started,
      });
      const attempt = AbortSignal.timeout(Math.min(attemptTimeoutMs(selection), remaining));
      try {
        const value = await operation(selection, AbortSignal.any([signal, attempt]));
        signal.throwIfAborted();
        return { value, selection };
      } catch (error) {
        if (signal.aborted)
          throw new ProviderFailure(
            {
              code: "CANCELLED",
              message: "요청이 취소되었습니다.",
              retryable: false,
              fallback: false,
            },
            selection,
          );
        const detail = attempt.aborted
          ? classifyProviderError({ name: "TimeoutError" })
          : classifyProviderError(error);
        last = new ProviderFailure(detail, selection);
        if (!detail.fallback) throw last;
        const delay = detail.retryAfterMs ?? 750;
        if (
          !detail.retryable ||
          delay > 8000 ||
          retry === 1 ||
          delay > budgetMs - (Date.now() - started) - 1000
        )
          break;
        onStatus({
          state: "retrying",
          message: detail.message + " 잠시 후 한 번 재시도합니다.",
          ...selection,
          code: detail.code,
          retryAfterMs: delay,
          attempt: retry + 2,
          elapsedMs: Date.now() - started,
        });
        await sleep(delay, signal);
      }
    }
  }
  throw last;
}
