import { requestSchema } from "../schemas";
import { runReliable, classifyProviderError, ProviderFailure, type AIStatus } from "../reliability";
import { VERIFIED_MODELS, type Selection } from "../catalog";
import {
  toolFor,
  validateToolOutput,
  HARNESS_VERSION,
  HARNESS_BUDGET_MS,
  MAX_PROVIDER_CANDIDATES,
} from "./tools";
import type { HarnessEvent } from "./events";

type Options = {
  input: unknown;
  candidates: Selection[];
  signal: AbortSignal;
  runId: string;
  budgetMs?: number;
  onStatus: (status: AIStatus) => void;
  onEvent: (event: HarnessEvent) => void;
  operation: (selection: Selection, signal: AbortSignal) => Promise<unknown>;
};
/** Model text cannot select arbitrary tools or hosts. Every successful attempt crosses this validator. */
export async function executeHarness(options: Options) {
  const input = requestSchema.parse(options.input);
  const tool = toolFor(input.action);
  const started = Date.now();
  let sequence = 0;
  const emit = (stage: HarnessEvent["stage"], selection?: Selection, code?: string) => {
    const event: HarnessEvent = {
      version: HARNESS_VERSION,
      runId: options.runId,
      sequence: ++sequence,
      action: input.action,
      stage,
      elapsedMs: Date.now() - started,
      ...(selection ? { provider: selection.provider, model: selection.model } : {}),
      ...(code ? { code } : {}),
    };
    // Observability must never change execution outcomes if the consumer disconnects.
    try {
      options.onEvent(event);
    } catch {
      /* disconnected observer */
    }
  };
  emit("accepted");
  try {
    options.signal.throwIfAborted();
    const first = options.candidates[0];
    if (first && !VERIFIED_MODELS[first.provider]?.includes(first.model))
      throw new ProviderFailure({ code: "MODEL_UNAVAILABLE", message: "허용되지 않은 모델입니다.", retryable: false, fallback: false }, first);
    const seen = new Set<string>();
    const candidates = options.candidates
      .filter((selection) => {
        const key = `${selection.provider}:${selection.model}`;
        if (seen.has(key) || !VERIFIED_MODELS[selection.provider]?.includes(selection.model))
          return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_PROVIDER_CANDIDATES);
    const result = await runReliable({
      candidates,
      allowFallback: input.allowFallback,
      signal: options.signal,
      budgetMs: Math.max(1, Math.min(options.budgetMs ?? HARNESS_BUDGET_MS, HARNESS_BUDGET_MS)),
      attemptTimeoutMs: (selection) => tool.attemptMs(selection.provider),
      onStatus: (status) => {
        if (["connecting", "processing", "retrying", "fallback"].includes(status.state))
          emit(
            status.state as HarnessEvent["stage"],
            candidates.find(
              (selection) =>
                selection.provider === status.provider && selection.model === status.model,
            ),
            status.code,
          );
        options.onStatus(status);
      },
      operation: async (selection, signal) => {
        emit("processing", selection);
        const raw = await options.operation(selection, signal);
        signal.throwIfAborted();
        emit("validating", selection);
        return validateToolOutput(input, raw);
      },
    });
    emit("completed", result.selection);
    return result;
  } catch (error) {
    const detail = error instanceof ProviderFailure ? error.detail : classifyProviderError(error);
    const stage =
      options.signal.aborted && options.signal.reason?.name !== "TimeoutError"
        ? "cancelled"
        : "failed";
    emit(stage, error instanceof ProviderFailure ? error.selection : undefined, detail.code);
    throw error;
  }
}
