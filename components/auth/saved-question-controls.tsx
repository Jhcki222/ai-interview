"use client";
import { useEffect, useState } from "react";
import type { Progress } from "@/types/question";
import { SpeechInput } from "@/components/ui/speech-input";

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
  answer = "",
  progress = { status: "NOT_STARTED", bookmarked: false },
  busy = false,
  onMutate,
}: Props) {
  const questionKey = `saved:${id}`;
  const [draft, setDraft] = useState(answer);
  useEffect(() => setDraft(answer), [answer]);
  return (
    <section aria-label="저장 질문 학습" style={{ display: "grid", gap: 16, marginTop: 24 }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onMutate("/api/me/answers", "POST", {
            question_key: questionKey,
            answer_text: draft,
          });
        }}
        style={{ display: "grid", gap: 12 }}
      >
        <input type="hidden" name="question_key" value={questionKey} />
        <label htmlFor={`${id}-saved-answer`}>나의 답변</label>
        <textarea
          id={`${id}-saved-answer`}
          className="textarea"
          name="answer_text"
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={20000}
          placeholder="이 질문에 대한 나만의 답변을 작성해 보세요."
        />
        <SpeechInput value={draft} onChange={setDraft} disabled={busy} />
        <button className="btn btn-primary" disabled={busy}>
          내 답변 저장
        </button>
      </form>
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
