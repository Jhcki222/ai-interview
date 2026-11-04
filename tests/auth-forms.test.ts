import { describe, expect, it } from "vitest";
import {
  authFormSchema,
  emailToUsername,
  formatSupabasePassword,
  usernameToEmail,
} from "../lib/auth/forms";
import { readInitialAuthUser } from "../lib/auth/session";

const valid = {
  username: "member123",
  password: "1234",
  confirmPassword: "1234",
  nickname: "  준비생  ",
};

describe("auth form validation and helpers", () => {
  it("rejects mismatched password confirmation for signup and update", () => {
    for (const mode of ["signup", "update"] as const) {
      const result = authFormSchema(mode).safeParse({ ...valid, confirmPassword: "5678" });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues.some((i) => i.path[0] === "confirmPassword")).toBe(true);
    }
  });

  it("enforces the 4-digit numeric password policy for login, signup, and update", () => {
    for (const invalidPwd of ["123", "12345", "abcd", "12a4", "", "12345678"]) {
      expect(
        authFormSchema("login").safeParse({ ...valid, password: invalidPwd }).success,
      ).toBe(false);
      expect(
        authFormSchema("signup").safeParse({
          ...valid,
          password: invalidPwd,
          confirmPassword: invalidPwd,
        }).success,
      ).toBe(false);
      expect(
        authFormSchema("update").safeParse({
          ...valid,
          password: invalidPwd,
          confirmPassword: invalidPwd,
        }).success,
      ).toBe(false);
    }
    for (const validPwd of ["0000", "1234", "9999", "0824"]) {
      expect(authFormSchema("login").safeParse({ ...valid, password: validPwd }).success).toBe(
        true,
      );
      expect(
        authFormSchema("signup").safeParse({
          ...valid,
          password: validPwd,
          confirmPassword: validPwd,
        }).success,
      ).toBe(true);
    }
  });

  it("validates username format and length for login and signup", () => {
    expect(authFormSchema("login").safeParse(valid).success).toBe(true);
    expect(authFormSchema("signup").safeParse(valid).success).toBe(true);
    // Invalid usernames
    for (const badUser of ["", "a", "a".repeat(21), "user@name", "user space"]) {
      expect(authFormSchema("login").safeParse({ ...valid, username: badUser }).success).toBe(
        false,
      );
      expect(authFormSchema("signup").safeParse({ ...valid, username: badUser }).success).toBe(
        false,
      );
    }
    // Valid Korean and alphanumeric usernames
    for (const goodUser of ["devkim", "user_1", "취준생01", "홍길동"]) {
      expect(authFormSchema("signup").safeParse({ ...valid, username: goodUser }).success).toBe(
        true,
      );
    }
  });

  it("trims nickname and enforces a meaningful minimum", () => {
    expect(authFormSchema("signup").parse(valid).nickname).toBe("준비생");
    expect(authFormSchema("signup").safeParse({ ...valid, nickname: " x " }).success).toBe(false);
    expect(authFormSchema("signup").safeParse({ ...valid, nickname: "   " }).success).toBe(false);
  });

  it("formats Supabase password and bidirectional username mapping", () => {
    expect(formatSupabasePassword("1234")).toBe("pin_1234_interview_ai");
    expect(formatSupabasePassword("1234").length).toBeGreaterThanOrEqual(6);

    const email = usernameToEmail("devkim");
    expect(email).toContain("@users.interview-ai.com");
    expect(emailToUsername(email)).toBe("devkim");

    const koreanEmail = usernameToEmail("개발자");
    expect(emailToUsername(koreanEmail)).toBe("개발자");
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
