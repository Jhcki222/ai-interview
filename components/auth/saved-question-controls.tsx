"use client";
import type { Progress } from "@/types/question";

type Props = {
  id: string;
  answer?: string;
  progress?: Progress;
  busy?: boolean;
  onMutate: (url: string, method: string, body: unknown) => Promise<void>;
};
const statuses = {
  NOT_STARTED: "시작 전",
  IN_PROGRESS: "학습 중",
  NEEDS_REVIEW: "복습 필요",
  COMPLETED: "학습 완료",
};

export function SavedQuestionControls({
  id,
  progress = { status: "NOT_STARTED", bookmarked: false },
  busy = false,
  onMutate,
}: Props) {
  const questionKey = `saved:${id}`;
  return (
    <section aria-label="저장 질문 학습" className="saved-learning-controls">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <label>
          학습 상태
          <select
            className="select"
            aria-label="저장 질문 학습 상태"
            value={progress.status}
            disabled={busy}
            onChange={(e) =>
              void onMutate("/api/me/progress", "POST", {
                question_key: questionKey,

                status: e.target.value,
              })
            }
          >
            {Object.entries(statuses).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn-secondary"
          aria-pressed={progress.bookmarked}
          disabled={busy}
          onClick={() =>
            void onMutate("/api/me/progress", "POST", {
              question_key: questionKey,

              bookmarked: !progress.bookmarked,
            })
          }
        >
          {progress.bookmarked ? "북마크 해제" : "북마크 추가"}
        </button>
      </div>
    </section>
  );
}
