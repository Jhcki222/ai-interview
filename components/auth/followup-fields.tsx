"use client";
import { useState } from "react";
import type { Question } from "@/types/question";

export function FollowupFields({
  initial = [],
  disabled = false,
}: {
  initial?: Question["followUps"];
  disabled?: boolean;
}) {
  const real = initial.filter((item) => !item.id.startsWith("unwritten-follow-up-"));
  const [enabled, setEnabled] = useState(real.length > 0);
  const [items, setItems] = useState(
    real.length ? real : [{ id: "draft-1", question: "", modelAnswer: "" }],
  );
  return (
    <section className="optional-followups">
      <label className="followup-switch">
        <span>
          <strong>꼬리질문 추가</strong>
          <small>선택 · 질문과 답변을 함께 보관하세요.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="꼬리질문 추가"
          checked={enabled}
          disabled={disabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
      </label>
      {enabled && (
        <div className="followup-fields">
          {items.map((item, index) => (
            <fieldset key={item.id} disabled={disabled}>
              <legend>꼬리질문 {index + 1}</legend>
              <label>
                질문
                <textarea
                  className="textarea"
                  name="followup_question"
                  value={item.question}
                  onChange={(event) =>
                    setItems((previous) =>
                      previous.map((entry) =>
                        entry.id === item.id ? { ...entry, question: event.target.value } : entry,
                      ),
                    )
                  }
                  required
                  maxLength={5000}
                  rows={2}
                />
              </label>
              <label>
                답변
                <textarea
                  className="textarea"
                  name="followup_answer"
                  value={item.modelAnswer}
                  onChange={(event) =>
                    setItems((previous) =>
                      previous.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, modelAnswer: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  required
                  maxLength={10000}
                  rows={3}
                />
              </label>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  setItems((previous) => previous.filter((entry) => entry.id !== item.id))
                }
              >
                꼬리질문 삭제
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={disabled || items.length >= 20}
            onClick={() =>
              setItems((previous) => [
                ...previous,
                { id: crypto.randomUUID(), question: "", modelAnswer: "" },
              ])
            }
          >
            + 꼬리질문 추가
          </button>
        </div>
      )}
    </section>
  );
}

export function readFollowups(data: FormData): Question["followUps"] {
  const answers = data.getAll("followup_answer");
  return data.getAll("followup_question").map((question, index) => ({
    id: `manual-follow-up-${crypto.randomUUID()}`,
    question: String(question).trim(),
    modelAnswer: String(answers[index] ?? "").trim(),
  }));
}
