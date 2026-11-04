import type { Question } from "@/types/question";
export function questionBatchPlan(count: 5 | 10 | 15) {
  const focus = ["핵심 개념과 대표 경험", "문제 해결 과정과 협업", "실무 적용과 판단 근거"];
  return Array.from({ length: count / 5 }, (_, index) => ({
    count: 5 as const,
    index,
    total: count / 5,
    focus: focus[index],
  }));
}
export function combineQuestionBatches(batches: Question[][]): Question[] {
  return batches.flatMap((questions, batch) => {
    if (questions.length !== 5 || new Set(questions.map((q) => q.id)).size !== 5)
      throw Object.assign(new Error("Invalid original batch"), { name: "AI_TypeValidationError" });
    return questions.map((q) =>
      batches.length === 1 ? q : { ...q, id: `batch-${batch + 1}-${q.id}`.slice(0, 100) },
    );
  });
}
