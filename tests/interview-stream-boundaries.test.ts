import { it, expect } from "vitest";
import { readBoundedText, RequestBodyTooLarge } from "../lib/ai/request-body";
import { previewText } from "../lib/ai/preview";
it("stops consuming chunked input as soon as the byte bound is crossed", async () => {
  let canceled = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(encoder.encode("한글"));
      c.enqueue(encoder.encode("더많은본문"));
    },
    cancel() {
      canceled = true;
    },
  });
  await expect(readBoundedText(stream, 10)).rejects.toBeInstanceOf(RequestBodyTooLarge);
  expect(canceled).toBe(true);
});
it("decodes split Korean UTF8 bytes accurately", async () => {
  const bytes = new TextEncoder().encode("한국어");
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes.slice(0, 2));
      c.enqueue(bytes.slice(2));
      c.close();
    },
  });
  await expect(readBoundedText(stream, 100)).resolves.toBe("한국어");
});
it("previews only human-readable partial text", () => {
  expect(
    previewText("generate", { questions: [{ question: "첫 질문" }, { question: "둘째 질문" }] }),
  ).toContain("둘째 질문");
  expect(previewText("evaluate", { revisedAnswer: "개선 중인 답변" })).toBe("개선 중인 답변");
  expect(previewText("generate", { questions: [{ question: { instruction: "bad" } }] })).toBe("");
});
