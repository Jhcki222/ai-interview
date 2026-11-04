import type { ReactNode } from "react";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
export default async function Protected({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user)
    return (
      <section className="panel empty-state">
        <h1 className="page-heading">나의 학습 공간</h1>
        <p>
          {getSupabaseConfig()
            ? "로그인하면 저장한 질문과 답변을 이어서 학습할 수 있습니다."
            : "회원 저장소 연결 설정이 필요합니다. Supabase 설정 후 로그인해 주세요."}
        </p>
        <Link className="btn btn-primary" href="/login">
          로그인하기
        </Link>
      </section>
    );
  return (
    <>
      <nav
        aria-label="나의 학습"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}
      >
        {[
          ["/my/questions", "내 질문"],
          ["/my/answers", "내 답변"],
          ["/my/bookmarks", "북마크"],
          ["/my/progress", "학습 현황"],
          ["/settings", "설정"],
        ].map(([href, label]) => (
          <Link key={href} className="btn btn-secondary" href={href}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
