"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeRedirect } from "@/lib/auth/validation";
import {
  authFormSchema,
  formatSupabasePassword,
  usernameToEmail,
  type AuthMode,
  type AuthValues,
} from "@/lib/auth/forms";

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
    defaultValues: { username: "", password: "", confirmPassword: "", nickname: "" },
    mode: "onBlur",
  });

  const titles = {
    login: "다시 만나 반가워요",
    signup: "오늘부터 차근차근 준비해요",
    reset: "비밀번호 안내",
    update: "새 비밀번호 설정",
  };

  async function submit({ username, password, nickname }: AuthValues) {
    if (!client) return;
    setMessage("");
    try {
      const destination = safeRedirect(next);
      const email = usernameToEmail(username);
      const supabasePassword = formatSupabasePassword(password);

      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({
          email,
          password: supabasePassword,
        });
        if (error) {
          setMessage("아이디 또는 비밀번호(숫자 4자리)를 확인해 주세요.");
          return;
        }
        router.push(destination);
        router.refresh();
        return;
      }

      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email,
          password: supabasePassword,
          options: {
            data: { username: username.trim(), nickname: nickname.trim() },
          },
        });
        if (error) {
          if (
            error.message?.includes("already registered") ||
            error.message?.includes("User already registered") ||
            error.status === 422
          ) {
            setMessage("이미 사용 중인 아이디입니다.");
          } else {
            setMessage("가입하지 못했습니다. 입력 내용을 확인해 주세요.");
          }
          return;
        }
        if (data.session) {
          router.push(destination);
          router.refresh();
          return;
        }
        // If the Supabase project does not auto-create a session, try signing in immediately
        const { error: signInErr } = await client.auth.signInWithPassword({
          email,
          password: supabasePassword,
        });
        if (!signInErr) {
          router.push(destination);
          router.refresh();
          return;
        }
        setMessage("가입이 완료되었습니다. 로그인해 주세요.");
        return;
      }

      if (mode === "update") {
        const { error } = await client.auth.updateUser({ password: supabasePassword });
        if (error) {
          setMessage("비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.");
          return;
        }
        router.push("/settings");
        router.refresh();
        return;
      }
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  }

  const errorFor = (field: keyof AuthValues) =>
    errors[field] && (
      <small id={`${field}-error`} role="alert" style={{ color: "var(--color-destructive, #dc414e)" }}>
        {errors[field]?.message}
      </small>
    );

  if (mode === "reset") {
    return (
      <section
        className="panel auth-card"
        style={{ maxWidth: 460, margin: "48px auto", padding: 32 }}
      >
        <p className="eyebrow">계정 안내</p>
        <h1 className="page-heading">{titles.reset}</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          본 서비스는 아이디와 숫자 4자리 비밀번호로 간편하게 이용하는 서비스입니다.
        </p>
        <div style={{ marginTop: 24, padding: 16, background: "var(--surface-muted)", borderRadius: 8 }}>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            비밀번호를 분실하신 경우 새로운 아이디로 회원가입하시거나 시스템 관리자에게 문의해 주세요.
            로그인 상태에서는 [계정 설정]에서 언제든지 숫자 4자리 비밀번호를 변경하실 수 있습니다.
          </p>
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <Link className="btn btn-primary" href="/login" style={{ textAlign: "center" }}>
            로그인으로 이동
          </Link>
          <Link className="btn btn-secondary" href="/signup" style={{ textAlign: "center" }}>
            새 아이디로 회원가입
          </Link>
        </div>
      </section>
    );
  }

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
            아이디
            <input
              className="input"
              type="text"
              autoComplete="username"
              maxLength={20}
              placeholder="영문, 숫자, 한글 2~20자"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? "username-error" : undefined}
              {...register("username")}
            />
            {errorFor("username")}
          </label>
        )}
        {mode === "signup" && (
          <label>
            닉네임
            <input
              className="input"
              autoComplete="nickname"
              maxLength={40}
              placeholder="2~40자"
              aria-invalid={!!errors.nickname}
              aria-describedby={errors.nickname ? "nickname-error" : undefined}
              {...register("nickname")}
            />
            {errorFor("nickname")}
          </label>
        )}
        <label>
          {mode === "update" ? "새 비밀번호 (숫자 4자리)" : "비밀번호"}
          <input
            className="input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="숫자 4자리"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? "password-error" : mode !== "login" ? "password-help" : undefined
            }
            {...register("password")}
          />
          {mode !== "login" && (
            <small id="password-help" className="muted">
              숫자 4자리를 입력해 주세요.
            </small>
          )}
          {errorFor("password")}
        </label>
        {(mode === "signup" || mode === "update") && (
          <label>
            {mode === "update" ? "새 비밀번호 확인" : "비밀번호 확인"}
            <input
              className="input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="숫자 4자리 재입력"
              autoComplete="new-password"
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
                : "비밀번호 변경"}
        </button>
        {message && (
          <p role="status" aria-live="polite" style={{ marginTop: 8, fontSize: 13, color: "var(--primary)" }}>
            {message}
          </p>
        )}
      </form>
      <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 13, justifyContent: "center" }}>
        {mode === "login" && (
          <>
            <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}>회원가입</Link>
            <span className="muted">·</span>
            <Link href="/reset-password">비밀번호 분실 안내</Link>
          </>
        )}
        {mode === "signup" && (
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>
            이미 계정이 있으신가요? 로그인
          </Link>
        )}
        {mode === "update" && <Link href="/settings">계정 설정으로 돌아가기</Link>}
      </div>
    </section>
  );
}
