import { expect, it } from "vitest";
import { companyDialogRequestMatches } from "../lib/auth/session";
it("unblocks the new account while rejecting the previous pending save completion", () => {
  const pending = { owner: "account-a", questionId: "question-one", version: 1 };
  expect(
    companyDialogRequestMatches(pending, {
      owner: "account-a",
      questionId: "question-one",
      version: 1,
    }),
  ).toBe(true);
  expect(
    companyDialogRequestMatches(pending, {
      owner: "account-b",
      questionId: "question-one",
      version: 1,
    }),
  ).toBe(false);
  expect(
    companyDialogRequestMatches(pending, {
      owner: "account-a",
      questionId: "question-two",
      version: 1,
    }),
  ).toBe(false);
  expect(
    companyDialogRequestMatches(pending, {
      owner: "account-a",
      questionId: "question-one",
      version: 2,
    }),
  ).toBe(false);
  expect(companyDialogRequestMatches(null, { owner: null, questionId: null, version: 1 })).toBe(
    false,
  );
});
