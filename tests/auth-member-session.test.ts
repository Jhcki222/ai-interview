import { expect, it } from "vitest";
import { canExposeMemberData, isCurrentMemberRequest } from "../lib/auth/session";
it("hides account data immediately after logout or switching accounts", () => {
  expect(canExposeMemberData("account-a", "account-a", false)).toBe(true);
  expect(canExposeMemberData(null, "account-a", false)).toBe(false);
  expect(canExposeMemberData("account-b", "account-a", false)).toBe(false);
  expect(canExposeMemberData("account-a", "account-a", true)).toBe(false);
});
it("discards responses from the previous account or an older request", () => {
  expect(isCurrentMemberRequest("a", "a", 2, 2)).toBe(true);
  expect(isCurrentMemberRequest("a", "b", 2, 2)).toBe(false);
  expect(isCurrentMemberRequest("a", null, 2, 2)).toBe(false);
  expect(isCurrentMemberRequest("a", "a", 1, 2)).toBe(false);
});
