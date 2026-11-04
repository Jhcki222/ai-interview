import { it, expect } from "vitest";
import { buildConversationRequest } from "../lib/ai/conversation";
import { requestSchema } from "../lib/ai/schemas";
it("keeps the latest three prior turns bounded and the current answer separate", () => {
  const previous = Array.from({ length: 9 }, (_, i) => ({
    question: `이전${i}` + "질".repeat(2000),
    answer: `시작${i}` + "답".repeat(3000) + "결론",
  }));
  const body = buildConversationRequest("evaluate", "현재 질문", "현재 답변", previous);
  expect(body.history).toHaveLength(3);
  expect(body.history[0].question).toContain("이전6");
  expect(body.history.at(-1)?.answer).toContain("결론");
  expect(body.history.every((t) => t.question.length <= 400 && t.answer.length <= 500)).toBe(
    true,
  );
  expect(body.question).toBe("현재 질문");
  expect(body.answer).toBe("현재 답변");
  expect(requestSchema.safeParse(body).success).toBe(true);
});
it("rejects unbounded histories at the server boundary and accepts legacy requests", () => {
  const base = { action: "followup", question: "질문", answer: "답변" };
  expect(requestSchema.safeParse(base).success).toBe(true);
  expect(
    requestSchema.safeParse({
      ...base,
      history: Array(7).fill({ question: "질문", answer: "답변" }),
    }).success,
  ).toBe(false);
  expect(
    requestSchema.safeParse({ ...base, history: [{ question: "q".repeat(1001), answer: "a" }] })
      .success,
  ).toBe(false);
  expect(
    requestSchema.safeParse({ ...base, history: [{ question: "q", answer: "a".repeat(1201) }] })
      .success,
  ).toBe(false);
});
it("keeps worst-case escaped histories and full current answers below byte limits", () => {
  const value = "\u0001".repeat(8000);
  const body = buildConversationRequest(
    "followup",
    value,
    value,
    Array(3).fill({ question: value, answer: value }),
  );
  expect(new TextEncoder().encode(JSON.stringify(body)).length).toBeLessThan(180000);
});
