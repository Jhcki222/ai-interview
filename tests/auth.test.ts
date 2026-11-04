import { describe, expect, it } from "vitest";
import {
  safeRedirect,
  answerSchema,
  progressSchema,
  savedQuestionSchema,
} from "../lib/auth/validation";

describe("member request boundaries", () => {
  it("allows only same origin relative redirects", () => {
    for (const unsafe of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/%2f%2fevil.test",
      "/login\nLocation: bad",
    ])
      expect(safeRedirect(unsafe)).toBe("/questions");
    expect(safeRedirect("/my/questions?tab=mine")).toBe("/my/questions?tab=mine");
  });
  it("rejects arbitrary question references and excessive answers", () => {
    expect(
      answerSchema.safeParse({ question_key: "../../other", answer_text: "hello" }).success,
    ).toBe(false);
    expect(
      answerSchema.safeParse({ question_key: "base:cs-001", answer_text: "a".repeat(20001) })
        .success,
    ).toBe(false);
    expect(
      answerSchema.safeParse({ question_key: "base:cs-001", answer_text: "answer" }).success,
    ).toBe(true);
  });
  it("requires valid progress and rejects owner injection", () => {
    expect(
      progressSchema.safeParse({ question_key: "base:cs-001", status: "HACKED", bookmarked: true })
        .success,
    ).toBe(false);
    expect(
      answerSchema.safeParse({ question_key: "base:cs-001", answer_text: "a", user_id: "someone" })
        .success,
    ).toBe(false);
  });
  it("rejects incomplete saved question snapshots", () => {
    expect(
      savedQuestionSchema.safeParse({ question: "a", modelAnswer: { summary: "a" } }).success,
    ).toBe(false);
  });
  it("requires a complete model answer and two complete followups when saving a question", () => {
    const question = {
      id: "custom-http",
      category: "CS",
      subcategory: "네트워크",
      topic: "HTTP",
      difficulty: "BASIC",
      importance: "ESSENTIAL",
      question: "HTTP의 무상태성이란?",
      modelAnswer: {
        summary: "요청 사이의 상태를 서버가 기본 보관하지 않습니다.",
        interviewAnswer: "각 요청에 처리에 필요한 정보를 포함합니다.",
        detailedExplanation: "세션이나 토큰으로 애플리케이션 상태를 따로 관리합니다.",
        example: "로그인 토큰을 각 요청에 보냅니다.",
        keywords: ["HTTP", "무상태"],
      },
      followUps: [
        {
          id: "f1",
          question: "쿠키와 세션의 차이는?",
          modelAnswer: "쿠키는 클라이언트에, 세션 데이터는 보통 서버에 저장합니다.",
        },
        {
          id: "f2",
          question: "무상태성과 연결 유지는 다른가요?",
          modelAnswer: "요청 상태와 전송 연결 재사용은 서로 다른 관심사입니다.",
        },
      ],
    };
    expect(savedQuestionSchema.safeParse(question).success).toBe(true);
    expect(
      savedQuestionSchema.safeParse({
        ...question,
        modelAnswer: { ...question.modelAnswer, interviewAnswer: null },
      }).success,
    ).toBe(false);
    expect(
      savedQuestionSchema.safeParse({ ...question, followUps: question.followUps.slice(0, 1) })
        .success,
    ).toBe(false);
    expect(
      savedQuestionSchema.safeParse({
        ...question,
        followUps: question.followUps.map((followup, index) =>
          index === 0 ? { ...followup, modelAnswer: "" } : followup,
        ),
      }).success,
    ).toBe(false);
  });
});
