import { describe, expect, it } from "vitest";
import { questions, filterQuestions, getQuestion, categories } from "../lib/questions";
import { validateQuestions } from "../lib/question-validation";

describe("question content", () => {
  it("contains the required category totals with complete unique content", () => {
    expect(validateQuestions(questions)).toEqual([]);
    expect(
      Object.fromEntries(
        categories.map((c) => [c.id, questions.filter((q) => q.category === c.id).length]),
      ),
    ).toEqual({
      CS: 104,
      BACKEND: 104,
      AI: 84,
      PERSONALITY: 32,
      MOTIVATION: 22,
      BUSINESS: 22,
      PROJECTS: 32,
    });
  });
  it("rejects duplicate IDs and missing follow-up answers", () => {
    const q = structuredClone(questions[0]);
    q.followUps[0].modelAnswer = "";
    expect(validateQuestions([q, q]).join(" ")).toMatch(/duplicate/i);
    expect(validateQuestions([q]).join(" ")).toMatch(/followUps/);
  });
  it("searches question text and keywords without case sensitivity", () => {
    const q = questions.find((q) => q.modelAnswer.keywords.includes("ACID"))!;
    expect(filterQuestions(questions, { query: "acid" })).toContain(q);
    expect(filterQuestions(questions, { query: q.question })).toContain(q);
    expect(getQuestion(q.id)).toBe(q);
    expect(getQuestion("missing")).toBeUndefined();
  });
  it("combines filters with AND and does not mutate the source", () => {
    const q = questions[0];
    const result = filterQuestions(questions, {
      category: q.category,
      subcategory: q.subcategory,
      difficulty: q.difficulty,
      importance: q.importance,
    });
    expect(result).toContain(q);
    expect(
      result.every(
        (v) =>
          v.category === q.category &&
          v.subcategory === q.subcategory &&
          v.difficulty === q.difficulty &&
          v.importance === q.importance,
      ),
    ).toBe(true);
    expect(filterQuestions(questions, { category: "AI", query: "존재하지않는검색어" })).toEqual([]);
    expect(filterQuestions(questions, {})).toHaveLength(400);
  });
});
