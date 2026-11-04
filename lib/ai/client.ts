"use client";
import { z } from "zod";
export async function requestAI<T>(
  body: unknown,
  schema: z.ZodType<T>,
  signal: AbortSignal,
  onProgress: (message: string) => void,
  onPreview?: (text: string) => void,
): Promise<T> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "AI 요청을 처리하지 못했습니다.");
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
        if (event === "progress") onProgress(payload.message);
        if (event === "preview" && typeof payload.text === "string")
          onPreview?.(payload.text.slice(0, 3000));
        if (event === "error") throw new Error(payload.message);
        if (event === "complete") complete = schema.parse(payload);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!complete) throw new Error("완료된 응답이 없습니다. 다시 시도해 주세요.");
  return complete;
}
