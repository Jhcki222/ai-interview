import type { Question } from "@/types/question";
export function namespaceQuestions(questions: Question[], sessionId: string): Question[] {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(sessionId)) throw new Error("면접 세션 ID를 확인해 주세요.");
  if (new Set(questions.map((q) => q.id)).size !== questions.length)
    throw new Error("질문 ID가 중복되었습니다.");
  return questions.map((question, index) => {
    const id = `ai-${sessionId}-${index + 1}`;
    return {
      ...question,
      id,
      followUps: question.followUps.map((follow, j) => ({
        ...follow,
        id: `${id}-followup-${j + 1}`,
      })),
    };
  });
}
