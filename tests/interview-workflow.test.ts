import { it, expect } from "vitest";
import { settingsSchema } from "../lib/ai/schemas";
import { restoreSession, transition } from "../lib/ai/state";
it("validates interview targeting and defaults legacy settings", () => {
  const old = { role: "개발자", level: "신입", count: 5, mode: "learn" };
  expect(settingsSchema.parse(old)).toMatchObject({
    company: "",
    division: "",
    jobPosting: "",
    interviewType: "comprehensive",
    difficulty: "INTERMEDIATE",
  });
  expect(settingsSchema.safeParse({ ...old, company: "x".repeat(101) }).success).toBe(false);
  expect(settingsSchema.safeParse({ ...old, interviewType: "unknown" }).success).toBe(false);
  expect(settingsSchema.safeParse({ ...old, jobPosting: "x".repeat(12001) }).success).toBe(false);
});
it("allows starting a conversation from generated learning questions", () =>
  expect(transition("LEARNING", "ANSWERING")).toBe("ANSWERING"));
it("restores learning drafts only under the matching session id", () => {
  const value = {
    version: 1,
    id: "session-a",
    phase: "REVIEW",
    settings: { role: "개발자", level: "신입", count: 5, mode: "learn" },
    analysis: { summary: "경험", skills: [], experiences: [], uncertainties: [] },
    questions: [],
    index: 0,
    turns: [],
    summary: null,
    draft: "",
    learningAnswers: { q: "내 답변" },
    learningEvaluations: {},
  };
  expect(restoreSession(JSON.stringify(value), "session-b")).toBeNull();
  expect(restoreSession(JSON.stringify(value), "session-a")).toMatchObject({
    learningAnswers: { q: "내 답변" },
  });
});
