"use client";

import { useState, type FormEvent } from "react";
import { categories } from "@/lib/questions";
import type { CategoryId } from "@/types/question";
import type { CompanyCollection } from "@/types/company";
import { createCompactQuestion } from "./compact-question";

export function CreateQuestionForm({
  onCreated,
  companies = [],
  initialCompanyId = null,
}: {
  onCreated: () => void;
  companies?: CompanyCollection[];
  initialCompanyId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (field: string) => String(data.get(field) ?? "").trim();
    const question = value("question");
    const answer = value("answer");
    const category = value("category");

    if (!question || !answer) {
      setError("질문과 답변을 모두 입력해 주세요.");
      return;
    }
    if (!categories.some((item) => item.id === category)) {
      setError("카테고리를 선택해 주세요.");
      return;
    }
    if (question.length > 5000 || answer.length > 10000) {
      setError("질문은 5,000자, 답변은 10,000자 이내로 입력해 주세요.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/me/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: value("company_id") || null,
          question: createCompactQuestion(category as CategoryId, question, answer),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "저장하지 못했습니다.");
      form.reset();
      setOpen(false);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ margin: "24px 0" }}>
      <button
        type="button"
        className="btn btn-primary"
        aria-expanded={open}
        aria-controls="create-question-form"
        onClick={() => {
          if (busy) return;
          setOpen((previous) => !previous);
          setError("");
        }}
      >
        {open ? "질문 작성 닫기" : "+ 질문 추가"}
      </button>
      {open && (
        <form
          id="create-question-form"
          onSubmit={submit}
          className="panel"
          style={{ padding: 24, marginTop: 16, display: "grid", gap: 16 }}
        >
          <div>
            <h2 style={{ marginBottom: 4 }}>내 질문 작성하기</h2>
            <p className="muted">회사와 카테고리를 선택하고 질문과 답변만 입력하면 됩니다.</p>
          </div>
          <div className="member-form-grid">
            <label>
              회사
              <select
                className="select"
                name="company_id"
                defaultValue={initialCompanyId ?? ""}
                disabled={busy}
              >
                <option value="">미분류</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}{company.position ? ` · ${company.position}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              카테고리
              <select name="category" className="select" disabled={busy} required>
                {categories.map((item) => (
                  <option value={item.id} key={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            질문
            <textarea
              name="question"
              className="textarea"
              rows={3}
              placeholder="예: Spring MVC와 WebFlux는 어떤 차이가 있나요?"
              required
              maxLength={5000}
              disabled={busy}
            />
          </label>
          <label>
            답변
            <textarea
              name="answer"
              className="textarea"
              rows={6}
              placeholder="면접에서 말할 답변을 작성해 주세요."
              required
              maxLength={10000}
              disabled={busy}
            />
          </label>
          {error && <p role="alert" className="company-error">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "저장 중…" : "질문 저장"}
          </button>
        </form>
      )}
    </div>
  );
}
