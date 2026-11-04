import { it, expect } from "vitest";
import { restoreSession } from "../lib/ai/state";
it("preserves active follow-up and count on session restore", () => {
  const followup = { question: "추가 질문", reason: "구체성 확인", modelAnswer: "모범답안" };
  const value = {
    version: 1,
    phase: "REVIEW",
    settings: { role: "개발자", level: "신입", count: 5, mode: "chat" },
    analysis: { summary: "요약", skills: [], experiences: [], uncertainties: [] },
    questions: [],
    index: 0,
    turns: [],
    summary: null,
    draft: "",
    followup,
    followupCount: 2,
  };
  expect(restoreSession(JSON.stringify(value))).toMatchObject({ followup, followupCount: 2 });
});
it("does not restore an answer screen without its complete question list", () => {
  const value = {
    version: 1,
    phase: "ANSWERING",
    settings: { role: "개발자", level: "신입", count: 5, mode: "chat" },
    analysis: { summary: "요약", skills: [], experiences: [], uncertainties: [] },
    questions: [],
    index: 0,
    turns: [],
    summary: null,
    draft: "",
  };
  expect(restoreSession(JSON.stringify(value))).toBeNull();
});
