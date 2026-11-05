"use client";
import { z } from "zod";
import { harnessEventSchema, type HarnessEvent } from "./harness/events";
import type { Selection } from "./catalog";
import type { AIStatus } from "./reliability";
export class AIRequestError extends Error {
  constructor(
    message: string,
    public code?: string,
    public correlationId?: string,
  ) {
    super(message);
  }
}
export async function requestAI<T>(
  body: unknown,
  schema: z.ZodType<T>,
  signal: AbortSignal,
  onProgress: (message: string) => void,
  onPreview?: (text: string) => void,
  options?: {
    selection?: Selection;
    allowFallback?: boolean;
    onStatus?: (status: AIStatus) => void;
    onHarness?: (event: HarnessEvent) => void;
  },
): Promise<T> {
  try {
    options?.onStatus?.({ state: "initializing", message: "요청을 초기화하고 있습니다." });
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(body as object),
        selection: options?.selection,
        allowFallback: options?.allowFallback ?? true,
      }),
      signal,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      options?.onStatus?.({
        state:
          error.code === "MISSING_CONFIG"
            ? "missingconfig"
            : error.code === "RATE_LIMIT"
              ? "ratelimit"
              : "failed",
        message: error.error || "AI 요청을 처리하지 못했습니다.",
        code: error.code,
        correlationId: error.correlationId,
      });
      throw new AIRequestError(
        error.error || "AI 요청을 처리하지 못했습니다.",
        error.code,
        error.correlationId,
      );
    }
    if (!response.body) throw new Error("스트리밍 연결을 열 수 없습니다.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let complete: T | undefined;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > 2000000) throw new Error("응답 크기 제한을 초과했습니다.");
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = block
            .split("\n")
            .find((line) => line.startsWith("event: "))
            ?.slice(7);
          const data = block
            .split("\n")
            .filter((line) => line.startsWith("data: "))
            .map((line) => line.slice(6))
            .join("\n");
          if (!data) continue;
          const payload = JSON.parse(data);
          if (event === "harness") {
            const record = harnessEventSchema.safeParse(payload);
            if (record.success) options?.onHarness?.(record.data);
          }
          if (event === "status") {
            options?.onStatus?.(payload);
            onProgress(payload.message);
          }
          if (event === "progress") onProgress(payload.message);
          if (event === "preview" && typeof payload.text === "string")
            onPreview?.(payload.text.slice(0, 3000));
          if (event === "error") {
            options?.onStatus?.({
              ...payload,
              state:
                payload.code === "TIMEOUT"
                  ? "timeout"
                  : payload.code === "RATE_LIMIT"
                    ? "ratelimit"
                    : payload.code === "MISSING_CONFIG"
                      ? "missingconfig"
                      : payload.code === "CANCELLED"
                        ? "cancelled"
                        : "failed",
            });
            throw new AIRequestError(payload.message, payload.code, payload.correlationId);
          }
          if (event === "complete") complete = schema.parse(payload);
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (!complete) throw new Error("완료된 응답이 없습니다. 다시 시도해 주세요.");
    return complete;
  } catch (error) {
    if (error instanceof AIRequestError) throw error;
    const timeout =
      (error instanceof Error && error.name === "TimeoutError") ||
      (signal.reason instanceof Error && signal.reason.name === "TimeoutError");
    const cancelled = signal.aborted && !timeout;
    const message = timeout
      ? "요청 시간이 초과되었습니다."
      : cancelled
        ? "요청을 취소했습니다."
        : "AI 연결 또는 완료 응답 검증에 실패했습니다. 다시 시도해 주세요.";
    const code = timeout ? "TIMEOUT" : cancelled ? "CANCELLED" : "CONNECTION_OR_RESPONSE_ERROR";
    options?.onStatus?.({
      state: timeout ? "timeout" : cancelled ? "cancelled" : "failed",
      message,
      code,
    });
    throw new AIRequestError(message, code);
  }
}
