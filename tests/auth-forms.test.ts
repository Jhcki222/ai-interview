import { describe, expect, it } from "vitest";
import { authFormSchema } from "../lib/auth/forms";
import { readInitialAuthUser } from "../lib/auth/session";
const valid = {
  email: "member@example.com",
  password: "testpass123",
  confirmPassword: "testpass123",
  nickname: "  준비생  ",
};
describe("auth form validation", () => {
  it("rejects mismatched password confirmation for signup and update", () => {
    for (const mode of ["signup", "update"] as const) {
      const result = authFormSchema(mode).safeParse({ ...valid, confirmPassword: "different123" });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues.some((i) => i.path[0] === "confirmPassword")).toBe(true);
    }
  });
  it("enforces the new password policy without blocking existing account login", () => {
    for (const password of ["short1", "onlyletters", "123456789"])
      expect(
        authFormSchema("signup").safeParse({ ...valid, password, confirmPassword: password })
          .success,
      ).toBe(false);
    expect(authFormSchema("login").safeParse({ ...valid, password: "legacy" }).success).toBe(true);
  });
  it("trims nickname and enforces a meaningful minimum", () => {
    expect(authFormSchema("signup").parse(valid).nickname).toBe("준비생");
    expect(authFormSchema("signup").safeParse({ ...valid, nickname: " x " }).success).toBe(false);
    expect(authFormSchema("signup").safeParse({ ...valid, nickname: "   " }).success).toBe(false);
  });
  it("does not require password or nickname for recovery email", () => {
    expect(
      authFormSchema("reset").safeParse({
        email: "a@example.com",
        password: "",
        confirmPassword: "",
        nickname: "",
      }).success,
    ).toBe(true);
  });
  it("ends initialization with no user if verification rejects", async () => {
    await expect(
      readInitialAuthUser(async () => {
        throw new Error("network");
      }),
    ).resolves.toBeNull();
    await expect(
      readInitialAuthUser(async () => ({ data: { user: { id: "real-user" } } })),
    ).resolves.toEqual({ id: "real-user" });
  });
});
