import { describe, it, expect } from "vitest";
import { buildSummaryRequest } from "../lib/ai/summary";
import { questionSchema, requestSchema, type Evaluation } from "../lib/ai/schemas";
import { savedQuestionSchema } from "../lib/auth/validation";
const names = ["정확성", "논리성", "구체성", "질문 적합성", "실무 적용성"] as const;
const evaluation: Evaluation = {
  score: 65,
  dimensions: names.map((name) => ({ name, score: 60, evidence: "답변근거".repeat(1600) })),
  strengths: ["강점".repeat(4000)],
  improvements: ["보완".repeat(4000)],
  revisedAnswer: "개선".repeat(4000),
};
describe("AI contracts", () => {
  it("sends bounded evidence for all 45 long Korean turns without changing originals", () => {
    const turns = Array.from({ length: 45 }, (_, i) => ({
      question: `질문${i}` + "질".repeat(7900),
      answer: "시작" + "답".repeat(7996) + "마침",
      evaluation,
    }));
    const body = buildSummaryRequest(turns);
    expect(new TextEncoder().encode(JSON.stringify(body)).length).toBeLessThan(180000);
    expect(requestSchema.safeParse(body).success).toBe(true);
    expect(body.turns).toHaveLength(45);
    expect(body.turns[0].answer).toContain("시작");
    expect(body.turns[0].answer).toContain("마침");
    expect(body.turns[0].evaluation.dimensions.map((x) => x.name)).toEqual(names);
    expect(body.turns[0].evaluation.dimensions.every((x) => x.evidence.length > 0)).toBe(true);
    expect(turns[0].answer).toHaveLength(8000);
  });
  it("also bounds JSON escaping overhead", () => {
    const value = "\u0001".repeat(8000);
    const turns = Array.from({ length: 45 }, () => ({
      question: value,
      answer: value,
      evaluation: {
        ...evaluation,
        dimensions: names.map((name) => ({ name, score: 10, evidence: value })),
        strengths: [value],
        improvements: [value],
      },
    }));
    expect(
      new TextEncoder().encode(JSON.stringify(buildSummaryRequest(turns))).length,
    ).toBeLessThan(180000);
  });
  it("AI generated questions cannot exceed member persistence field bounds", () => {
    const base = {
      id: "generated",
      category: "CS",
      subcategory: "s",
      topic: "t",
      difficulty: "BASIC",
      importance: "ESSENTIAL",
      question: "q",
      modelAnswer: {
        summary: "s",
        interviewAnswer: "a",
        detailedExplanation: "d",
        example: "e",
        keywords: ["k"],
      },
      followUps: [
        { id: "a", question: "q", modelAnswer: "a" },
        { id: "b", question: "q", modelAnswer: "a" },
      ],
      source: { type: "document", evidence: "source" },
    };
    for (const change of [
      { subcategory: "x".repeat(101) },
      { topic: "x".repeat(201) },
      { question: "x".repeat(5001) },
      { source: { type: "x".repeat(101), evidence: "e" } },
      { modelAnswer: { ...base.modelAnswer, keywords: ["x".repeat(101)] } },
      { followUps: [{ id: "x".repeat(151), question: "q", modelAnswer: "a" }, base.followUps[1]] },
    ])
      expect(questionSchema.safeParse({ ...base, ...change }).success).toBe(false);
    expect(savedQuestionSchema.safeParse(questionSchema.parse(base)).success).toBe(true);
  });
});
