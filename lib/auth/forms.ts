import { z } from "zod";

export type AuthMode = "login" | "signup" | "reset" | "update";

export const usernameRegex = /^[a-zA-Z0-9_\uac00-\ud7a3]{2,20}$/;
export const pinRegex = /^\d{4}$/;

/**
 * Maps a user-chosen ID (username) to an internal email format accepted by Supabase GoTrue.
 */
export function usernameToEmail(username: string): string {
  const trimmed = username.trim().toLowerCase();
  if (/^[a-z0-9_.-]+$/.test(trimmed)) {
    return `${trimmed}@users.interview-ai.com`;
  }
  const hex = Array.from(new TextEncoder().encode(trimmed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `u_${hex}@users.interview-ai.com`;
}

/**
 * Extracts the user-facing ID (username) from an internal email format.
 */
export function emailToUsername(email?: string | null): string {
  if (!email) return "";
  const local = email.split("@")[0];
  if (local.startsWith("u_")) {
    try {
      const hex = local.slice(2);
      const bytes = new Uint8Array(
        hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
      );
      return new TextDecoder().decode(bytes);
    } catch {
      return local;
    }
  }
  return local;
}

/**
 * Deterministically formats the user's 4-digit PIN into a Supabase-compliant password
 * that satisfies Supabase GoTrue's server-side minimum 6-character length policy.
 */
export function formatSupabasePassword(pin: string): string {
  return `pin_${pin}_interview_ai`;
}

export function authFormSchema(mode: AuthMode) {
  return z
    .object({
      username: z.string().trim(),
      password: z.string(),
      confirmPassword: z.string(),
      nickname: z.string().trim(),
    })
    .superRefine((values, context) => {
      const issue = (field: "username" | "password" | "confirmPassword" | "nickname", message: string) =>
        context.addIssue({ code: "custom", path: [field], message });

      if (mode === "login" || mode === "signup") {
        if (!values.username) {
          issue("username", "아이디를 입력해 주세요.");
        } else if (values.username.length < 2 || values.username.length > 20) {
          issue("username", "아이디는 2~20자로 입력해 주세요.");
        } else if (!usernameRegex.test(values.username)) {
          issue("username", "아이디는 영문, 숫자, 밑줄(_), 한글 2~20자여야 합니다.");
        }
      }

      if (mode === "signup" && (values.nickname.length < 2 || values.nickname.length > 40)) {
        issue("nickname", "닉네임은 앞뒤 공백을 제외하고 2~40자로 입력해 주세요.");
      }

      if (mode === "login") {
        if (!values.password) {
          issue("password", "비밀번호를 입력해 주세요.");
        } else if (!pinRegex.test(values.password)) {
          issue("password", "비밀번호는 숫자 4자리여야 합니다.");
        }
      }

      if (mode === "signup" || mode === "update") {
        if (!values.password) {
          issue("password", "비밀번호를 입력해 주세요.");
        } else if (!pinRegex.test(values.password)) {
          issue("password", "비밀번호는 숫자 4자리여야 합니다.");
        }
        if (values.password !== values.confirmPassword) {
          issue("confirmPassword", "비밀번호가 일치하지 않습니다.");
        }
      }
    });
}

export type AuthValues = z.infer<ReturnType<typeof authFormSchema>>;
