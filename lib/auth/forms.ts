import { z } from "zod";
export type AuthMode = "login" | "signup" | "reset" | "update";
export function authFormSchema(mode: AuthMode) {
  return z
    .object({
      email: z.string().trim(),
      password: z.string(),
      confirmPassword: z.string(),
      nickname: z.string().trim(),
    })
    .superRefine((values, context) => {
      const issue = (field: keyof typeof values, message: string) =>
        context.addIssue({ code: "custom", path: [field], message });
      if (mode !== "update" && !z.email().max(254).safeParse(values.email).success)
        issue("email", "올바른 이메일 주소를 입력해 주세요.");
      if (mode === "signup" && (values.nickname.length < 2 || values.nickname.length > 40))
        issue("nickname", "닉네임은 앞뒤 공백을 제외하고 2~40자로 입력해 주세요.");
      if (mode === "login" && (!values.password || values.password.length > 128))
        issue("password", "비밀번호를 입력해 주세요.");
      if (mode === "signup" || mode === "update") {
        if (
          values.password.length < 8 ||
          values.password.length > 128 ||
          !/[A-Za-z]/.test(values.password) ||
          !/[0-9]/.test(values.password)
        )
          issue("password", "영문과 숫자를 포함하여 8~128자로 입력해 주세요.");
        if (values.password !== values.confirmPassword)
          issue("confirmPassword", "비밀번호가 일치하지 않습니다.");
      }
    });
}
export type AuthValues = z.infer<ReturnType<typeof authFormSchema>>;
