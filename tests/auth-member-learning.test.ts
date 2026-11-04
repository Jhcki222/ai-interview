import { describe, expect, it } from "vitest";
import { buildMemberDashboard, filterSavedQuestions } from "../lib/auth/member-learning";
import type { Question } from "../types/question";
const question = (id: string, category: Question["category"], text: string): Question => ({
  id,
  category,
  subcategory: "network",
  topic: "topic",
  difficulty: "BASIC",
  importance: "ESSENTIAL",
  question: text,
  modelAnswer: {
    summary: "summary",
    interviewAnswer: "answer",
    detailedExplanation: "detail",
    example: "example",
    keywords: ["HTTP"],
  },
  followUps: [
    { id: "f1", question: "follow", modelAnswer: "answer" },
    { id: "f2", question: "follow2", modelAnswer: "answer2" },
  ],
});
describe("member learning summaries", () => {
  const saved = [
    {
      id: "saved-one",
      question: question("base-one", "BACKEND", "개인 서버 질문"),
      note: "트랜잭션 메모",
      updated_at: "2026-11-04T02:00:00Z",
    },
  ];
  it("filters saved snapshots by their edited category, question and notes", () => {
    expect(filterSavedQuestions(saved, "개인 서버", "BACKEND")).toHaveLength(1);
    expect(filterSavedQuestions(saved, "", "CS")).toHaveLength(0);
    expect(filterSavedQuestions(saved, "트랜잭션", "ALL")).toHaveLength(1);
  });
  it("counts real answers and progress independently for base and saved copies", () => {
    const result = buildMemberDashboard(
      [question("base-one", "CS", "원본 질문"), question("base-two", "CS", "다른 질문")],
      saved,
      {
        answers: {
          "base:base-one": "실제 답변",
          "base:base-two": "   ",
          "saved:saved-one": "개인 답변",
        },
        progress: {
          "base:base-one": { status: "COMPLETED", bookmarked: false },
          "saved:saved-one": { status: "NEEDS_REVIEW", bookmarked: true },
        },
        updatedAt: {
          "base:base-one": "2026-11-04T03:00:00Z",
          "saved:saved-one": "2026-11-04T04:00:00Z",
        },
      },
    );
    expect(result.metrics).toEqual({
      total: 3,
      answered: 2,
      completed: 1,
      needsReview: 1,
      bookmarked: 1,
    });
    expect(result.categories.CS).toEqual({ total: 2, answered: 1, completed: 1 });
    expect(result.categories.BACKEND).toEqual({ total: 1, answered: 1, completed: 0 });
    expect(result.recent.map((row) => row.key)).toEqual(["saved:saved-one", "base:base-one"]);
  });
  it("ignores unknown question keys and invalid timestamps instead of inventing recent activity", () => {
    const result = buildMemberDashboard([], [], {
      answers: { "base:missing": "답변" },
      progress: { "base:missing": { status: "COMPLETED", bookmarked: true } },
      updatedAt: { "base:missing": "not-a-date" },
    });
    expect(result.metrics).toEqual({
      total: 0,
      answered: 0,
      completed: 0,
      needsReview: 0,
      bookmarked: 0,
    });
    expect(result.recent).toEqual([]);
  });
});
