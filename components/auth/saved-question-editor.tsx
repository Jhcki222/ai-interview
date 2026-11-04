"use client";
import { useState, type FormEvent } from "react";
import { categories } from "@/lib/questions";
import { savedQuestionSchema } from "@/lib/auth/validation";
import type { SavedQuestionRecord } from "@/lib/auth/member-learning";
import type { Question } from "@/types/question";
import type { CompanyCollection } from "@/types/company";

export function SavedQuestionEditor({
  record,
  busy,
  onSave,
  onCancel,
  companies = [],
}: {
  record: SavedQuestionRecord;
  busy: boolean;
  onSave: (payload: {
    question: Question;
    note: string;
    company_id: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  companies?: CompanyCollection[];
}) {
  const [followUps, setFollowUps] = useState(
    record.question.followUps.map((item) => ({ ...item })),
  );
  const [error, setError] = useState("");
  function updateFollowup(index: number, field: "question" | "modelAnswer", value: string) {
    setFollowUps((items) =>
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const result = savedQuestionSchema.safeParse({
      ...record.question,
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
      followUps,
    });
    if (!result.success) {
      setError("필수 답안과 두 개 이상의 꼬리질문을 모두 입력하고, 입력 길이를 확인해 주세요.");
      return;
    }
    setError("");
    await onSave({
      question: result.data,
      note: value("note"),
      company_id: value("company_id") || null,
    });
  }
  return (
    <form onSubmit={submit} className="saved-question-editor" style={{ display: "grid", gap: 16 }}>
      <h2>내가 만든 질문 편집</h2>
      <label>
        기업 폴더
        <select className="select" name="company_id" defaultValue={record.company_id ?? ""}>
          <option value="">미분류</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
              {company.position ? ` · ${company.position}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="member-form-grid">
        <label>
          카테고리
          <select className="select" name="category" defaultValue={record.question.category}>
            {categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          하위 분류
          <input
            className="input"
            name="subcategory"
            defaultValue={record.question.subcategory}
            required
            maxLength={100}
          />
        </label>
        <label>
          주제
          <input
            className="input"
            name="topic"
            defaultValue={record.question.topic}
            required
            maxLength={200}
          />
        </label>
        <label>
          난이도
          <select className="select" name="difficulty" defaultValue={record.question.difficulty}>
            <option value="BASIC">기초</option>
            <option value="INTERMEDIATE">중급</option>
            <option value="ADVANCED">심화</option>
          </select>
        </label>
        <label>
          중요도
          <select className="select" name="importance" defaultValue={record.question.importance}>
            <option value="ESSENTIAL">필수</option>
            <option value="IMPORTANT">중요</option>
            <option value="ADVANCED">심화</option>
          </select>
        </label>
      </div>
      <label>
        질문
        <textarea
          className="textarea"
          name="question"
          defaultValue={record.question.question}
          required
          maxLength={5000}
        />
      </label>
      {(["summary", "interviewAnswer", "detailedExplanation", "example"] as const).map(
        (field, index) => (
          <label key={field}>
            {["핵심 요약", "면접 답변", "상세 설명", "예시"][index]}
            <textarea
              className="textarea"
              name={field}
              defaultValue={record.question.modelAnswer[field]}
              required
              maxLength={
                field === "interviewAnswer" || field === "detailedExplanation" ? 20000 : 10000
              }
            />
          </label>
        ),
      )}
      <label>
        핵심 키워드 (쉼표로 구분)
        <input
          className="input"
          name="keywords"
          defaultValue={record.question.modelAnswer.keywords.join(", ")}
          maxLength={3000}
        />
      </label>
      <fieldset>
        <legend>꼬리질문 · 최소 2개 / 최대 20개</legend>
        {followUps.map((item, index) => (
          <div
            className="member-followup-editor"
            key={item.id}
            style={{ display: "grid", gap: 12, margin: "16px 0" }}
          >
            <label>
              꼬리질문 {index + 1}
              <input
                className="input"
                value={item.question}
                onChange={(event) => updateFollowup(index, "question", event.target.value)}
                required
                maxLength={5000}
              />
            </label>
            <label>
              꼬리질문 {index + 1} 답안
              <textarea
                className="textarea"
                value={item.modelAnswer}
                onChange={(event) => updateFollowup(index, "modelAnswer", event.target.value)}
                required
                maxLength={10000}
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || followUps.length <= 2}
              onClick={() =>
                setFollowUps((items) =>
                  items.length > 2 ? items.filter((_, i) => i !== index) : items,
                )
              }
            >
              꼬리질문 {index + 1} 삭제
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || followUps.length >= 20}
          onClick={() =>
            setFollowUps((items) =>
              items.length < 20
                ? [
                    ...items,
                    { id: `follow-up-${crypto.randomUUID()}`, question: "", modelAnswer: "" },
                  ]
                : items,
            )
          }
        >
          꼬리질문 추가
        </button>
      </fieldset>
      <label>
        개인 메모
        <textarea name="note" className="textarea" defaultValue={record.note} maxLength={10000} />
      </label>
      {error && <p role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" disabled={busy}>
          변경 저장
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  );
}
