"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Github } from "lucide-react";
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
  const [socialBusy, setSocialBusy] = useState<"google" | "github" | null>(null);
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

  async function handleOAuth(provider: "google" | "github") {
    if (!client) {
      setMessage("인증 서버 설정(Supabase 환경변수)이 로드되지 않았습니다. Vercel 환경변수를 확인해 주세요.");
      return;
    }
    setSocialBusy(provider);
    setMessage("");
    try {
      const destination = safeRedirect(next);
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });
      if (error) {
        setMessage(`${provider === "google" ? "구글(Gmail)" : "GitHub"} 로그인 진행 중 오류: ${error.message}`);
        setSocialBusy(null);
      }
    } catch (err: any) {
      setMessage(err?.message || "소셜 로그인 중 네트워크 오류가 발생했습니다.");
      setSocialBusy(null);
    }
  }

  async function submit({ username, password, nickname }: AuthValues) {
    if (!client) {
      setMessage("인증 서버 설정(Supabase 환경변수)이 로드되지 않았습니다. Vercel 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)를 확인해 주세요.");
      return;
    }
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
          const errMsg = error.message || "";
          if (errMsg.includes("Email not confirmed") || (error as any).code === "email_not_confirmed") {
            setMessage("Supabase 프로젝트 설정에서 'Confirm email'이 켜져 있습니다. Supabase 대시보드 > Authentication > Providers > Email에서 'Confirm email'을 OFF로 변경해야 아이디로 즉시 로그인할 수 있습니다.");
          } else if (errMsg.includes("Invalid login credentials")) {
            setMessage("등록되지 않은 아이디이거나 비밀번호(숫자 4자리)가 일치하지 않습니다. 회원가입을 먼저 진행해 주세요.");
          } else {
            setMessage(errMsg || "아이디 또는 비밀번호(숫자 4자리)를 확인해 주세요.");
          }
          return;
        }
        router.push(destination);
        router.refresh();
        return;
      }

      if (mode === "signup") {
        // Try server-side admin signup first to bypass email confirmation & rate limits
        try {
          const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, nickname }),
          });
          const result = await res.json();
          if (res.ok && result.autoConfirmed) {
            const { error: signInErr } = await client.auth.signInWithPassword({
              email,
              password: supabasePassword,
            });
            if (!signInErr) {
              router.push(destination);
              router.refresh();
              return;
            }
          } else if (result.error && !result.fallback) {
            setMessage(result.error);
            return;
          }
        } catch {
          // Fall back to client SDK
        }

        const { data, error } = await client.auth.signUp({
          email,
          password: supabasePassword,
          options: {
            data: { username: username.trim(), nickname: nickname.trim() },
          },
        });
        if (error) {
          const errMsg = error.message || "";
          if (
            errMsg.includes("already registered") ||
            errMsg.includes("User already registered") ||
            error.status === 422
          ) {
            setMessage("이미 사용 중인 아이디입니다.");
          } else if (
            errMsg.toLowerCase().includes("rate limit") ||
            (error as any).code === "over_email_send_rate_limit"
          ) {
            setMessage(
              "Supabase의 이메일 전송 한도(시간당 3~4회)를 초과했습니다. 본 서비스는 아이디 기반 서비스이므로, Supabase 대시보드 > Authentication > Providers > Email에서 'Confirm email'을 OFF(비활성화)하시면 이메일 발송 없이 즉시 가입 및 로그인이 가능합니다."
            );
          } else {
            setMessage(errMsg || "가입하지 못했습니다. 입력 내용을 확인해 주세요.");
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
        if (signInErr.message?.includes("Email not confirmed") || (signInErr as any).code === "email_not_confirmed") {
          setMessage("가입은 완료되었으나 Supabase의 'Confirm email'이 켜져 있어 로그인이 제한됩니다. Supabase 대시보드 > Authentication > Providers > Email에서 'Confirm email'을 OFF로 변경해 주세요.");
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
      {!client && (
        <div style={{ marginTop: 12, padding: 12, background: "rgba(239, 68, 68, 0.1)", color: "var(--color-destructive, #dc414e)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, fontSize: 13, lineHeight: 1.5 }}>
          ⚠️ Supabase 환경변수가 로드되지 않았습니다. Vercel 대시보드 Settings → Environment Variables에 <strong>NEXT_PUBLIC_SUPABASE_URL</strong>과 <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong>가 등록되어 있는지 확인해 주세요.
        </div>
      )}
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

      {(mode === "login" || mode === "signup") && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              color: "var(--muted)",
              fontSize: 12,
            }}
          >
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span>또는 소셜 계정으로 시작</span>
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              type="button"
              className="btn"
              onClick={() => handleOAuth("google")}
              disabled={!client || isSubmitting || socialBusy !== null}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                background: "#ffffff",
                color: "#1f2937",
                border: "1px solid var(--border)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                fontWeight: 500,
                fontSize: 13,
                borderRadius: 8,
                padding: "10px 16px",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
            >
              <GoogleIcon />
              <span>{socialBusy === "google" ? "Google 연결 중…" : "Google로 계속하기"}</span>
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => handleOAuth("github")}
              disabled={!client || isSubmitting || socialBusy !== null}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                background: "#24292f",
                color: "#ffffff",
                border: "1px solid #24292f",
                fontWeight: 500,
                fontSize: 13,
                borderRadius: 8,
                padding: "10px 16px",
                cursor: "pointer",
                transition: "opacity 0.15s ease",
              }}
            >
              <Github size={18} />
              <span>{socialBusy === "github" ? "GitHub 연결 중…" : "GitHub로 계속하기"}</span>
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginTop: 20, fontSize: 13, justifyContent: "center" }}>
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
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}


