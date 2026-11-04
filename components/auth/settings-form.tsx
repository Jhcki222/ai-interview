"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "./auth-provider";
import { canExposeMemberData } from "@/lib/auth/session";

export function SettingsForm() {
  const { user, loading, configured, signOut } = useAuth();
  const ownerId = user?.id ?? null;
  const owner = useRef(ownerId);
  owner.current = ownerId;
  const [profile, setProfile] = useState<{
    ownerId: string;
    nickname: string;
    email: string;
  } | null>(null);
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState<{ ownerId: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!ownerId || loading) return;
    let active = true;
    setBusy(false);
    setMessage(null);
    fetch("/api/me/profile")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!active) return;
        setProfile({ ownerId, nickname: data.nickname, email: data.email });
        setNickname(data.nickname);
      })
      .catch(() => {
        if (active)
          setMessage({
            ownerId,
            message: "프로필을 불러오지 못했습니다. 페이지를 새로고침해 주세요.",
          });
      });
    return () => {
      active = false;
    };
  }, [ownerId, loading]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ownerId || owner.current !== ownerId) return;
    const requestOwner = ownerId;
    setBusy(true);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      if (owner.current === requestOwner)
        setMessage({
          ownerId: requestOwner,
          message: response.ok
            ? "프로필을 저장했습니다."
            : "닉네임을 2~40자로 입력하고 다시 시도해 주세요.",
        });
    } catch {
      if (owner.current === requestOwner)
        setMessage({ ownerId: requestOwner, message: "네트워크 오류가 발생했습니다." });
    } finally {
      if (owner.current === requestOwner) setBusy(false);
    }
  }
  if (loading) return <p role="status">계정을 확인하는 중…</p>;
  if (!configured || !ownerId)
    return (
      <section className="panel empty-state">
        <h1 className="page-heading">계정 설정</h1>
        <p>로그인이 필요합니다.</p>
        <Link className="btn btn-primary" href="/login">
          로그인하기
        </Link>
      </section>
    );
  const feedback = message?.ownerId === ownerId ? message.message : "";
  if (!canExposeMemberData(ownerId, profile?.ownerId ?? null, loading))
    return (
      <section className="panel">
        <h1 className="page-heading">계정 설정</h1>
        <p role="status">{feedback || "프로필을 불러오는 중…"}</p>
      </section>
    );
  return (
    <section className="member-settings" style={{ maxWidth: 640 }}>
      <p className="eyebrow">ACCOUNT</p>
      <h1 className="page-heading">계정 설정</h1>
      <div className="panel" style={{ padding: 24 }}>
        <p className="muted">{profile?.email}</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <label>
            닉네임
            <input
              className="input"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              minLength={2}
              maxLength={40}
              required
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            프로필 저장
          </button>
        </form>
        <p role="status">{feedback}</p>
        <Link href="/reset-password">비밀번호 재설정 이메일 받기</Link>
        <hr style={{ margin: "24px 0" }} />
        <button
          className="btn btn-secondary"
          onClick={async () => {
            try {
              await signOut();
              location.assign("/");
            } catch {
              if (owner.current === ownerId)
                setMessage({ ownerId, message: "로그아웃하지 못했습니다. 다시 시도해 주세요." });
            }
          }}
        >
          로그아웃
        </button>
      </div>
    </section>
  );
}
