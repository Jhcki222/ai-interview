"use client";
import { useState, type FormEvent } from "react";
import { categories } from "@/lib/questions";
import type { CompanyCollection } from "@/types/company";
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
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/me/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: value("company_id") || null,
          question: {
            id: `custom-${crypto.randomUUID()}`,
            category: value("category"),
            subcategory: value("subcategory"),
            topic: value("topic"),
            difficulty: value("difficulty"),
            importance: value("importance"),
            question: value("question"),
            modelAnswer: {
              summary: value("summary"),
              interviewAnswer: value("interviewAnswer"),
              detailedExplanation: value("detailedExplanation"),
              example: value("example"),
              keywords: value("keywords")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            },
            followUps: [0, 1].map((i) => ({
              id: `follow-up-${i + 1}`,
              question: value(`fq${i}`),
              modelAnswer: value(`fa${i}`),
            })),
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset();
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ margin: "24px 0" }}>
      <button className="btn btn-primary" onClick={() => setOpen(!open)}>
        {open ? "새 질문 작성 닫기" : "+ 질문 추가"}
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="panel"
          style={{ padding: 24, marginTop: 16, display: "grid", gap: 16 }}
        >
          <h2>나만의 면접 질문</h2>
          <label>
            기업 폴더
            <select className="select" name="company_id" defaultValue={initialCompanyId ?? ""}>
              <option value="">미분류</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                  {company.position ? ` · ${company.position}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            카테고리
            <select name="category" className="select">
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            난이도
            <select name="difficulty" className="select">
              <option value="BASIC">기초</option>
              <option value="INTERMEDIATE">중급</option>
              <option value="ADVANCED">심화</option>
            </select>
          </label>
          <label>
            중요도
            <select name="importance" className="select">
              <option value="ESSENTIAL">필수</option>
              <option value="IMPORTANT">중요</option>
              <option value="ADVANCED">심화</option>
            </select>
          </label>
          {[
            ["subcategory", "하위 분류"],
            ["topic", "주제"],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <input name={name} className="input" required maxLength={100} />
            </label>
          ))}
          {[
            ["question", "면접 질문"],
            ["summary", "핵심 요약"],
            ["interviewAnswer", "면접 답변"],
            ["detailedExplanation", "상세 설명"],
            ["example", "구체적인 예시"],
            ["fq0", "꼬리질문 1"],
            ["fa0", "꼬리질문 1 답안"],
            ["fq1", "꼬리질문 2"],
            ["fa1", "꼬리질문 2 답안"],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <textarea
                name={name}
                className="textarea"
                required
                maxLength={name === "question" || name.startsWith("fq") ? 5000 : 10000}
              />
            </label>
          ))}
          <label>
            핵심 키워드 (쉼표로 구분)
            <input name="keywords" className="input" maxLength={500} />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "저장 중…" : "내가 만든 질문에 저장"}
          </button>
          <p role="alert">{error}</p>
        </form>
      )}
    </div>
  );
}
