import { it, expect } from "vitest";
import { questionBatchPlan, combineQuestionBatches } from "../lib/ai/batches";
import type { Question } from "../types/question";
it("splits larger generation into independent five-question batches", () => {
  expect(questionBatchPlan(5)).toHaveLength(1);
  expect(questionBatchPlan(10)).toHaveLength(2);
  expect(questionBatchPlan(15).map((b) => b.count)).toEqual([5, 5, 5]);
});
it("checks original ids before namespacing separate batch results", () => {
  const one = Array.from(
    { length: 5 },
    (_, i) => ({ id: `q${i}`, followUps: [] }) as unknown as Question,
  );
  const combined = combineQuestionBatches([one, one]);
  expect(combined).toHaveLength(10);
  expect(new Set(combined.map((q) => q.id)).size).toBe(10);
  expect(() => combineQuestionBatches([[one[0], one[0], ...one.slice(2)]])).toThrow();
  expect(one[0].id).toBe("q0");
});
