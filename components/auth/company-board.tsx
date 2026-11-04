"use client";
import { useState, type FormEvent } from "react";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COMPANY_STAGES, type CompanyCollection, type CompanyStage } from "@/types/company";
import { companyInputSchema, companyStageLabels, groupCompanies } from "@/lib/auth/companies";
import type { MemberLearningState, SavedQuestionRecord } from "@/lib/auth/member-learning";
import "./company-board.css";

export function CompanyBoard({
  companies,
  questions,
  state,
  selected,
  onSelect,
  onChanged,
}: {
  companies: CompanyCollection[];
  questions: SavedQuestionRecord[];
  state: MemberLearningState;
  selected: string;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CompanyCollection | null>(null);
  const [open, setOpen] = useState(false);
  const [initialStage, setInitialStage] = useState<CompanyStage>("PREPARING");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const grouped = groupCompanies(companies, search);
  const unassigned = questions.filter((question) => !question.company_id).length;
  function create(stage: CompanyStage = "PREPARING") {
    setEditing(null);
    setInitialStage(stage);
    setError("");
    setOpen(true);
  }
  async function changeStage(company: CompanyCollection, stage: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/me/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "단계를 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="company-space" aria-label="기업별 질문 보드">
      <div className="company-space-heading">
        <div>
          <span className="company-kicker">
            <FolderOpen size={14} /> MY QUESTION COLLECTIONS
          </span>
          <h2>기업마다, 더 가까운 준비.</h2>
          <p>내가 만든 질문을 지원 기업별로 모아두세요.</p>
        </div>
        <button className="btn btn-primary" onClick={() => create()}>
          <Plus size={16} />
          기업 추가
        </button>
      </div>
      <div className="company-toolbar">
        <div className="company-scope-tabs">
          <button className={selected === "ALL" ? "selected" : ""} onClick={() => onSelect("ALL")}>
            전체 질문<span>{questions.length}</span>
          </button>
          <button
            className={selected === "UNASSIGNED" ? "selected" : ""}
            onClick={() => onSelect("UNASSIGNED")}
          >
            미분류<span>{unassigned}</span>
          </button>
        </div>
        <label className="company-search">
          <Search size={15} />
          <span className="sr-only">기업 검색</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="기업 · 지원 직무 검색"
          />
          {search && (
            <button aria-label="기업 검색 지우기" onClick={() => setSearch("")}>
              <X size={13} />
            </button>
          )}
        </label>
      </div>
      {error && (
        <p role="alert" className="company-error">
          {error}
        </p>
      )}
      <div className="company-board">
        {COMPANY_STAGES.map((stage, index) => (
          <section
            className={`company-column company-column-${stage.toLowerCase()}`}
            key={stage}
            aria-label={companyStageLabels[stage]}
          >
            <header className="company-column-heading">
              <span className="company-stage-dot" />
              <h3>{companyStageLabels[stage]}</h3>
              <span className="company-column-count">{grouped[stage].length}</span>
              <button
                aria-label={`${companyStageLabels[stage]} 기업 추가`}
                onClick={() => create(stage)}
              >
                <Plus size={16} />
              </button>
            </header>
            <div className="company-column-cards">
              {grouped[stage].map((company) => {
                const own = questions.filter((question) => question.company_id === company.id);
                const answered = own.filter((question) =>
                  state.answers[`saved:${question.id}`]?.trim(),
                ).length;
                return (
                  <article
                    key={company.id}
                    className={`company-card ${selected === company.id ? "is-selected" : ""}`}
                  >
                    <div className="company-card-top">
                      <button
                        className={`company-mark company-mark-${index}`}
                        onClick={() => onSelect(company.id)}
                        aria-label={`${company.name} 질문 보기`}
                      >
                        {company.name.slice(0, 1)}
                      </button>
                      <button
                        className="company-edit"
                        aria-label={`${company.name} 기업 편집`}
                        onClick={() => {
                          setEditing(company);
                          setError("");
                          setOpen(true);
                        }}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                    <button className="company-card-title" onClick={() => onSelect(company.id)}>
                      <h4>{company.name}</h4>
                      <p>{company.position || "지원 직무를 추가해 보세요"}</p>
                    </button>
                    <div className="company-card-detail">
                      <span>
                        <FolderOpen size={13} />
                        <strong>{own.length}</strong>개 질문
                      </span>
                      <span>
                        답변 {answered}/{own.length}
                      </span>
                    </div>
                    {company.deadline && (
                      <div className="company-deadline">
                        <CalendarDays size={12} />
                        {company.deadline.replaceAll("-", ".")}
                        <span>마감</span>
                      </div>
                    )}
                    <div className="company-card-bottom">
                      <select
                        aria-label={`${company.name} 준비 단계`}
                        disabled={busy}
                        value={company.stage}
                        onChange={(event) => void changeStage(company, event.target.value)}
                      >
                        {COMPANY_STAGES.map((value) => (
                          <option key={value} value={value}>
                            {companyStageLabels[value]}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => onSelect(company.id)}
                        aria-label={`${company.name} 질문 열기`}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </article>
                );
              })}
              {!grouped[stage].length && (
                <button className="company-column-empty" onClick={() => create(stage)}>
                  <Building2 size={21} />
                  <span>{search ? "검색된 기업이 없어요" : "준비할 기업을 추가해 보세요"}</span>
                  <small>
                    <Plus size={12} />
                    기업 추가
                  </small>
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="company-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "기업 정보 편집" : "새로운 기업 준비하기"}</DialogTitle>
            <DialogDescription>
              기업과 지원 직무를 저장하고 질문을 한곳에 모으세요.
            </DialogDescription>
          </DialogHeader>
          <CompanyForm
            key={editing?.id ?? `new-${initialStage}`}
            company={editing}
            initialStage={initialStage}
            onSaved={() => {
              setOpen(false);
              onChanged();
            }}
            onDeleted={() => {
              if (selected === editing?.id) onSelect("UNASSIGNED");
              setOpen(false);
              onChanged();
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CompanyForm({
  company,
  initialStage,
  onSaved,
  onDeleted,
}: {
  company: CompanyCollection | null;
  initialStage: CompanyStage;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = companyInputSchema.safeParse({
      name: data.get("name"),
      position: data.get("position"),
      stage: data.get("stage"),
      deadline: data.get("deadline") || null,
    });
    if (!parsed.success) {
      setError("기업명과 날짜를 확인해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        company ? `/api/me/companies/${company.id}` : "/api/me/companies",
        {
          method: company ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "기업을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !company ||
      !confirm(
        `${company.name} 기업 폴더를 삭제할까요? 질문과 답변은 삭제되지 않고 미분류로 이동합니다.`,
      )
    )
      return;
    setBusy(true);
    try {
      const response = await fetch(`/api/me/companies/${company.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "기업을 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="company-form" onSubmit={submit}>
      <label>
        기업명<span aria-hidden="true"> *</span>
        <input
          className="input"
          name="name"
          defaultValue={company?.name}
          placeholder="예: 토스"
          maxLength={100}
          required
          autoFocus
        />
      </label>
      <label>
        지원 직무
        <input
          className="input"
          name="position"
          defaultValue={company?.position}
          placeholder="예: 백엔드 개발자"
          maxLength={150}
        />
      </label>
      <div className="company-form-row">
        <label>
          준비 단계
          <select className="select" name="stage" defaultValue={company?.stage ?? initialStage}>
            {COMPANY_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {companyStageLabels[stage]}
              </option>
            ))}
          </select>
        </label>
        <label>
          마감일 (선택)
          <input
            className="input"
            type="date"
            name="deadline"
            defaultValue={company?.deadline ?? ""}
          />
        </label>
      </div>
      {error && (
        <p className="company-error" role="alert">
          {error}
        </p>
      )}
      <div className="company-form-footer">
        {company && (
          <button
            className="company-delete"
            type="button"
            disabled={busy}
            onClick={() => void remove()}
          >
            <Trash2 size={14} />
            기업 삭제
          </button>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "저장 중…" : company ? "변경 저장" : "기업 만들기"}
        </button>
      </div>
    </form>
  );
}
