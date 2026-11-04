import { describe, expect, it } from "vitest";
import {
  restoreGuestLearning,
  importableAnswers,
  importableProgress,
} from "@/lib/learning/session";
describe("guest draft recovery", () => {
  it("discards malformed JSON rather than crashing the learning screen", () => {
    expect(restoreGuestLearning("{invalid")).toEqual({ answers: {}, progress: {} });
  });
  it("only recovers supported progress and string answers", () => {
    expect(
      restoreGuestLearning(
        JSON.stringify({
          answers: { "base:cs-os-001": "독립 주소 공간", evil: { value: "x" } },
          progress: {
            "base:cs-os-001": { status: "NEEDS_REVIEW", bookmarked: true },
            "base:bad": { status: "ADMIN", bookmarked: true },
          },
        }),
      ),
    ).toEqual({
      answers: { "base:cs-os-001": "독립 주소 공간" },
      progress: { "base:cs-os-001": { status: "NEEDS_REVIEW", bookmarked: true } },
    });
  });
  it("never overwrites a member answer when importing guest drafts", () => {
    expect(
      importableAnswers(
        { "base:a": "임시 답변", "base:b": "새 답변", "base:c": "  " },
        { "base:a": "저장된 답변" },
      ),
    ).toEqual([["base:b", "새 답변"]]);
  });
  it("imports meaningful status-only guest records without overwriting member progress", () => {
    expect(
      importableProgress(
        {
          "base:a": { status: "COMPLETED", bookmarked: false },
          "base:b": { status: "NEEDS_REVIEW", bookmarked: false },
          "base:c": { status: "NOT_STARTED", bookmarked: false },
        },
        { "base:a": { status: "IN_PROGRESS", bookmarked: true } },
      ),
    ).toEqual([["base:b", { status: "NEEDS_REVIEW", bookmarked: false }]]);
  });
  it("limits recovered answer size and ignores unknown key shapes", () => {
    expect(
      restoreGuestLearning(
        JSON.stringify({
          answers: { "base:a": "x".repeat(20001), __proto__: "no", "base:b": "정상" },
        }),
      ).answers,
    ).toEqual({ "base:b": "정상" });
  });
});
