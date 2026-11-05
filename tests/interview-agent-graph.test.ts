import { describe, it, expect } from "vitest";
import { routeInterview, agentContextSchema } from "../lib/ai/agent-graph";
const evaluation = (score: number) => ({
  score,
  dimensions: ["정확성", "논리성", "구체성", "질문 적합성", "실무 적용성"].map((name) => ({
    name,
    score,
    evidence: "답변의 근거가 부족합니다.",
  })),
  strengths: ["핵심 언급"],
  improvements: ["구체적인 검증 방법을 설명하세요."],
  revisedAnswer: "개선 답변",
});
const context = { questionIndex: 0, questionCount: 5, followupCount: 0, turnCount: 1 };
describe("interview agent graph", () => {
  it("routes weak answers to a focused followup", () => {
    const result = routeInterview(evaluation(50), context);
    expect(result.action).toBe("followup");
    expect(result.focus).toBe("정확성");
    expect(result.trace.map((item) => item.node)).toEqual([
      "evaluate",
      "validate",
      "route",
      "await_confirmation",
    ]);
  });
  it("moves on after sufficient evidence", () =>
    expect(routeInterview(evaluation(85), context).action).toBe("next"));
  it("caps followups at two even for weak answers", () =>
    expect(routeInterview(evaluation(30), { ...context, followupCount: 2 }).action).toBe("next"));
  it("finishes only after the final question or turn cap", () => {
    expect(routeInterview(evaluation(90), { ...context, questionIndex: 4 }).action).toBe("finish");
    expect(routeInterview(evaluation(20), { ...context, turnCount: 44 }).action).toBe("finish");
  });
  it("rejects impossible graph context and invalid model evaluations", () => {
    expect(agentContextSchema.safeParse({ ...context, questionIndex: 5 }).success).toBe(false);
    expect(() => routeInterview({ ...evaluation(50), dimensions: [] }, context)).toThrow();
  });
});
