import Link from "next/link";
import { categories, questions } from "@/lib/questions";
import {
  buildMemberDashboard,
  type MemberLearningState,
  type SavedQuestionRecord,
} from "@/lib/auth/member-learning";

export function LearningDashboard({
  saved,
  state,
}: {
  saved: SavedQuestionRecord[];
  state: MemberLearningState;
}) {
  const dashboard = buildMemberDashboard(questions, saved, state);
  const metrics = [
    ["학습 가능 질문", dashboard.metrics.total],
    ["답변 작성", dashboard.metrics.answered],
    ["학습 완료", dashboard.metrics.completed],
    ["복습 필요", dashboard.metrics.needsReview],
    ["북마크", dashboard.metrics.bookmarked],
  ] as const;
  return (
    <div className="member-dashboard">
      <div
        className="member-metrics"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
          gap: 16,
          margin: "24px 0",
        }}
      >
        {metrics.map(([label, count]) => (
          <div className="panel" key={label} style={{ padding: 20 }}>
            <p className="muted">{label}</p>
            <strong style={{ fontSize: 28 }}>{count}</strong>
          </div>
        ))}
      </div>
      <section className="panel member-category-progress" style={{ padding: 24, marginBottom: 24 }}>
        <h2>카테고리별 학습</h2>
        <p className="muted">기본 질문과 내 질문을 합친 실제 질문 수를 기준으로 계산합니다.</p>
        {categories.map((category) => {
          const item = dashboard.categories[category.id];
          const percent = item.total ? Math.round((item.completed / item.total) * 100) : 0;
          return (
            <div key={category.id} style={{ margin: "20px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{category.name}</strong>
                <span className="muted">
                  완료 {item.completed} / {item.total} · 답변 {item.answered}
                </span>
              </div>
              <progress
                aria-label={`${category.name} 학습 완료율`}
                value={item.completed}
                max={item.total || 1}
                style={{ width: "100%", height: 10 }}
              />
              <small className="muted">{percent}% 완료</small>
            </div>
          );
        })}
      </section>
      <section className="panel member-recent" style={{ padding: 24, marginBottom: 24 }}>
        <h2>최근 학습·저장 질문</h2>
        <p className="muted">질문 저장과 답변·학습 기록의 마지막 변경 시간 순입니다.</p>
        {dashboard.recent.length ? (
          <ol>
            {dashboard.recent.map((item) => (
              <li key={item.key} style={{ margin: "18px 0" }}>
                <Link
                  href={
                    item.key.startsWith("base:")
                      ? `/questions/${item.question.id}`
                      : `/my/questions#saved-${item.key.slice(6)}`
                  }
                >
                  {item.question.question}
                </Link>
                <div className="muted">
                  <time dateTime={item.updatedAt}>
                    {new Date(item.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                  </time>
                  {item.answered ? " · 답변 작성" : ""}
                  {item.progress?.status === "COMPLETED" ? " · 학습 완료" : ""}
                  {item.progress?.status === "NEEDS_REVIEW" ? " · 복습 필요" : ""}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">아직 학습 기록이 없습니다. 첫 답변을 작성해 보세요.</p>
        )}
      </section>
    </div>
  );
}
