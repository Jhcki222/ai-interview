"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeRedirect } from "@/lib/auth/validation";
import { authFormSchema, type AuthMode, type AuthValues } from "@/lib/auth/forms";

export function AuthForm({ mode, next = "/questions" }: { mode: AuthMode; next?: string }) {
  const router = useRouter();
  const [client] = useState(() => createClient());
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(authFormSchema(mode)),
    defaultValues: { email: "", password: "", confirmPassword: "", nickname: "" },
    mode: "onBlur",
  });
  const titles = {
    login: "다시 만나 반가워요",
    signup: "오늘부터 차근차근 준비해요",
    reset: "비밀번호 재설정",
    update: "새 비밀번호 설정",
  };
  async function submit({ email, password, nickname }: AuthValues) {
    if (!client) return;
    setMessage("");
    try {
      const destination = safeRedirect(next);
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage("이메일 또는 비밀번호를 확인해 주세요.");
          return;
        }
        router.push(destination);
        router.refresh();
        return;
      }
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { nickname },
            emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
          },
        });
        if (error) {
          setMessage("가입하지 못했습니다. 입력 내용과 이메일 연결 설정을 확인해 주세요.");
          return;
        }
        if (data.session) {
          router.push(destination);
          router.refresh();
          return;
        }
        setMessage(
          "이메일을 확인해 주세요. 확인 링크를 보냈다면 해당 링크를 열어 가입을 완료할 수 있습니다.",
        );
        return;
      }
      if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/auth/update-password`,
        });
        setMessage(
          error
            ? "재설정 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
            : "해당 계정이 있으면 재설정 이메일을 보냅니다. 이메일을 확인해 주세요.",
        );
        return;
      }
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        setMessage(
          "비밀번호를 변경하지 못했습니다. 다시 로그인하거나 새 재설정 링크를 요청해 주세요.",
        );
        return;
      }
      router.push("/settings");
      router.refresh();
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  }
  const errorFor = (field: keyof AuthValues) =>
    errors[field] && (
      <small id={`${field}-error`} role="alert">
        {errors[field]?.message}
      </small>
    );
  return (
    <section
      className="panel auth-card"
      style={{ maxWidth: 460, margin: "48px auto", padding: 32 }}
    >
      <p className="eyebrow">나만의 면접 준비</p>
      <h1 className="page-heading">{titles[mode]}</h1>
      <p className="muted">답변과 학습 기록을 안전하게 이어가세요.</p>
      {!client && <p role="status">회원 기능을 사용하려면 Supabase 연결 설정이 필요합니다.</p>}
      <form
        onSubmit={handleSubmit(submit)}
        noValidate
        style={{ display: "grid", gap: 16, marginTop: 24 }}
      >
        {mode !== "update" && (
          <label>
            이메일
            <input
              className="input"
              type="email"
              autoComplete="email"
              maxLength={254}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errorFor("email")}
          </label>
        )}
        {mode === "signup" && (
          <label>
            닉네임
            <input
              className="input"
              autoComplete="nickname"
              maxLength={40}
              aria-invalid={!!errors.nickname}
              aria-describedby={errors.nickname ? "nickname-error" : undefined}
              {...register("nickname")}
            />
            {errorFor("nickname")}
          </label>
        )}
        {mode !== "reset" && (
          <label>
            비밀번호
            <input
              className="input"
              type="password"
              maxLength={128}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              aria-invalid={!!errors.password}
              aria-describedby={
                errors.password ? "password-error" : mode !== "login" ? "password-help" : undefined
              }
              {...register("password")}
            />
            {mode !== "login" && (
              <small id="password-help" className="muted">
                영문과 숫자를 포함하여 8자 이상 입력해 주세요.
              </small>
            )}
            {errorFor("password")}
          </label>
        )}
        {(mode === "signup" || mode === "update") && (
          <label>
            비밀번호 확인
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              {...register("confirmPassword")}
            />
            {errorFor("confirmPassword")}
          </label>
        )}
        <button className="btn btn-primary" disabled={!client || isSubmitting}>
          {isSubmitting
            ? "처리 중…"
            : mode === "login"
              ? "로그인"
              : mode === "signup"
                ? "회원가입"
                : mode === "reset"
                  ? "재설정 이메일 보내기"
                  : "비밀번호 변경"}
        </button>
        <p role="status" aria-live="polite">
          {message}
        </p>
      </form>
      <div style={{ display: "flex", gap: 16 }}>
        <Link href="/login">로그인</Link>
        <Link href="/signup">회원가입</Link>
        <Link href="/reset-password">비밀번호 찾기</Link>
      </div>
    </section>
  );
}
