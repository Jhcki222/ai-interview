import { expect, it } from "vitest";
import { resolveSavedQuestionDeepLink } from "../lib/auth/companies";
const questions = [
  { id: "company-question", company_id: "company-one" },
  { id: "unassigned-question", company_id: null },
];
it("opens the company containing a saved question linked by query", () => {
  expect(
    resolveSavedQuestionDeepLink(
      questions,
      "?question=company-question",
      "#saved-unassigned-question",
    ),
  ).toEqual({ questionId: "company-question", companyFilter: "company-one" });
});
it("opens legacy hash links in unassigned and ignores missing/corrupt targets", () => {
  expect(resolveSavedQuestionDeepLink(questions, "", "#saved-unassigned-question")).toEqual({
    questionId: "unassigned-question",
    companyFilter: "UNASSIGNED",
  });
  expect(resolveSavedQuestionDeepLink(questions, "?question=missing", "")).toBeNull();
  expect(resolveSavedQuestionDeepLink(questions, "", "#saved-%ZZ")).toBeNull();
});
