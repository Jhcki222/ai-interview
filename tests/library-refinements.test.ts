import { describe, it, expect } from "vitest";
import { createCompactQuestion, withCompactFollowups } from "../components/auth/compact-question";
import { buildMemberDashboard } from "../lib/auth/member-learning";
import { savedQuestionSchema } from "../lib/auth/validation";
import { isSocialOnly } from "../lib/auth/login-method";

describe("company library refinements", () => {
  it("counts frontend questions without crashing the learning dashboard", () => {
    const question = createCompactQuestion("FRONTEND", "렌더링이란?", "화면을 그리는 과정입니다.");
    const result = buildMemberDashboard([question], [], {
      answers: { [`base:${question.id}`]: "답변" },
      progress: { [`base:${question.id}`]: { status: "COMPLETED", bookmarked: true } },
    });
    expect(result.categories.FRONTEND).toEqual({ total: 1, answered: 1, completed: 1 });
    expect(result.metrics.completed).toBe(1);
  });
  it("stores one optional followup while preserving the database snapshot shape", () => {
    const question = withCompactFollowups(createCompactQuestion("CS", "질문", "답변"), [
      { id: "real", question: "꼬리질문", modelAnswer: "추가 답변" },
    ]);
    expect(savedQuestionSchema.safeParse(question).success).toBe(true);
    expect(
      question.followUps.filter((item) => !item.id.startsWith("unwritten-follow-up-")),
    ).toHaveLength(1);
  });
  it("supports no followups and preserves all entered followups", () => {
    const original = createCompactQuestion("CS", "질문", "답변");
    expect(savedQuestionSchema.safeParse(withCompactFollowups(original, [])).success).toBe(true);
    const items = [1, 2, 3].map((n) => ({
      id: `real-${n}`,
      question: `질문 ${n}`,
      modelAnswer: `답변 ${n}`,
    }));
    expect(withCompactFollowups(original, items).followUps).toEqual(items);
  });
  it("shows password changes only for accounts with a password login method", () => {
    expect(isSocialOnly(["google"])).toBe(true);
    expect(isSocialOnly(["github"])).toBe(true);
    expect(isSocialOnly(["email", "google"])).toBe(false);
    expect(isSocialOnly(["email"])).toBe(false);
  });
});
