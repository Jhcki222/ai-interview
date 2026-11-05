import { evaluationSchema } from "./schemas";
import { agentContextSchema, agentDecisionSchema, type AgentDecision } from "./agent-contract";
export { agentContextSchema } from "./agent-contract";

/** The model evaluates evidence; the graph alone selects an allowed transition. */
export function routeInterview(rawEvaluation: unknown, rawContext: unknown): AgentDecision {
  const evaluation = evaluationSchema.parse(rawEvaluation);
  const context = agentContextSchema.parse(rawContext);
  if (new Set(evaluation.dimensions.map((dimension) => dimension.name)).size !== 5)
    throw new Error("Duplicate evaluation dimensions");
  const weakest = [...evaluation.dimensions].sort((a, b) => a.score - b.score)[0];
  let action: AgentDecision["action"];
  let reason: string;
  if (context.turnCount >= 44) {
    action = "finish";
    reason = "전체 면접 턴 한도에 도달해 종합 평가로 이동합니다.";
  } else if (weakest.score < 70 && context.followupCount < 2) {
    action = "followup";
    reason = `${weakest.name} 평가가 ${weakest.score}점으로, 이 부분의 근거를 더 확인할 꼬리질문을 제안합니다.`;
  } else if (context.questionIndex >= context.questionCount - 1) {
    action = "finish";
    reason = "마지막 질문의 평가를 마쳤습니다. 전체 답변을 종합해 학습 계획을 정리합니다.";
  } else {
    action = "next";
    reason =
      context.followupCount >= 2
        ? "이 질문의 꼬리질문 2회를 모두 사용했습니다. 다음 주제로 이동합니다."
        : "모든 평가 영역이 70점 이상입니다. 다른 주제로 넘어가 역량을 확인합니다.";
  }
  return agentDecisionSchema.parse({
    version: 1,
    action,
    reason,
    focus: weakest.name,
    trace: [
      { node: "evaluate", detail: "현재 답변을 다섯 영역으로 평가했습니다." },
      { node: "validate", detail: "점수 범위·평가 영역 중복·응답 형식을 검증했습니다." },
      { node: "route", detail: reason },
      { node: "await_confirmation", detail: "사용자의 확인 후 다음 도구를 실행합니다." },
    ],
  });
}
