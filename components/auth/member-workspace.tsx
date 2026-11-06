"use client";
import { notifyLearningChanged } from "@/lib/learning/progress";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { LoadingState } from "@/components/ui/loading-state";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Question } from "@/types/question";
import { categories, questions } from "@/lib/questions";
import {
  filterSavedQuestions,
  type SavedQuestionRecord,
  type MemberLearningState,
} from "@/lib/auth/member-learning";
import { CreateQuestionForm } from "./create-question-form";
import { isCompactManualQuestion } from "./compact-question";
import { SavedQuestionControls } from "./saved-question-controls";
import { SavedQuestionEditor } from "./saved-question-editor";
import { LearningDashboard } from "./learning-dashboard";
import { useAuth } from "./auth-provider";
import { canExposeMemberData, isCurrentMemberRequest } from "@/lib/auth/session";
import type { CompanyCollection } from "@/types/company";
import { filterCompanyQuestions, resolveSavedQuestionDeepLink } from "@/lib/auth/companies";
import { CompanyBoard } from "./company-board";
import { SpeechInput } from "@/components/ui/speech-input";

const statusNames = {
  NOT_STARTED: "시작 전",
  IN_PROGRESS: "학습 중",
  NEEDS_REVIEW: "복습 필요",
  COMPLETED: "학습 완료",
};
export function MemberWorkspace({
  view,
}: {
  view: "questions" | "answers" | "bookmarks" | "progress";
}) {
  const { user, loading: authLoading, configured } = useAuth();
  const ownerId = user?.id ?? null;
  const search = useSearchParams().toString();
  const [linkHash, setLinkHash] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [deepLinkTarget, setDeepLinkTarget] = useState<string | null>(null);
  const handledDeepLink = useRef<string | null>(null);
  useEffect(() => {
    const update = () => setLinkHash(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const [loaded, setLoaded] = useState<{
    ownerId: string;
    saved: SavedQuestionRecord[];
    state: MemberLearningState;
    companies: CompanyCollection[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ ownerId: string | null; message: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("BOARD");
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const loadVersion = useRef(0);
  const mutationVersion = useRef(0);
  const visibleOwner = canExposeMemberData(ownerId, loaded?.ownerId ?? null, authLoading);
  const saved = visibleOwner ? loaded!.saved : [];
  const companies = visibleOwner ? loaded!.companies : [];
  const state: MemberLearningState = visibleOwner ? loaded!.state : { answers: {}, progress: {} };
  const error = failure?.ownerId === ownerId ? failure.message : "";
  const load = useCallback(async () => {
    if (!ownerId || authLoading) return;
    const requestOwner = ownerId;
    const version = ++loadVersion.current;
    setLoading(true);
    setFailure(null);
    try {
      const responses = await Promise.all([
        fetch("/api/me/questions"),
        fetch("/api/me/state"),
        fetch("/api/me/companies"),
      ]);
      const [a, b, c] = await Promise.all(responses.map((response) => response.json()));
      if (!isCurrentMemberRequest(requestOwner, currentOwner.current, version, loadVersion.current))
        return;
      if (responses.some((response) => !response.ok))
        throw new Error(a.error || b.error || c.error);
      setLoaded({ ownerId: requestOwner, saved: a.questions, state: b, companies: c.companies });
      setFailure(null);
    } catch (e) {
      if (isCurrentMemberRequest(requestOwner, currentOwner.current, version, loadVersion.current))
        setFailure({
          ownerId: requestOwner,
          message: e instanceof Error ? e.message : "불러오지 못했습니다.",
        });
    } finally {
      if (isCurrentMemberRequest(requestOwner, currentOwner.current, version, loadVersion.current))
        setLoading(false);
    }
  }, [ownerId, authLoading]);
  useEffect(() => {
    setBusy(false);
    setEditing(null);
    setQuery("");
    setCategory("ALL");
    setCompanyFilter("BOARD");
    setDeepLinkTarget(null);
    handledDeepLink.current = null;
    void load();
    return () => {
      loadVersion.current++;
      mutationVersion.current++;
    };
  }, [load]);
  async function mutate(url: string, method: string, body?: unknown) {
    if (!ownerId || ownerId !== currentOwner.current || authLoading) return;
    const requestOwner = ownerId;
    const version = ++mutationVersion.current;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = await response.json();
      if (
        !isCurrentMemberRequest(
          requestOwner,
          currentOwner.current,
          version,
          mutationVersion.current,
        )
      )
        return;
      if (!response.ok) throw new Error(result.error);
      notifyLearningChanged(requestOwner);
      setEditing(null);
      await load();
    } catch (e) {
      if (
        isCurrentMemberRequest(requestOwner, currentOwner.current, version, mutationVersion.current)
      )
        setFailure({
          ownerId: requestOwner,
          message: e instanceof Error ? e.message : "요청을 처리하지 못했습니다.",
        });
    } finally {
      if (
        isCurrentMemberRequest(requestOwner, currentOwner.current, version, mutationVersion.current)
      )
        setBusy(false);
    }
  }
  const lookup = (key: string) =>
    key.startsWith("saved:")
      ? saved.find((row) => row.id === key.slice(6))?.question
      : questions.find((question) => question.id === key.slice(5));
  const visibleSaved = filterCompanyQuestions(
    filterSavedQuestions(saved, query, category),
    companyFilter,
  );
  const selectedCompany = companies.find((company) => company.id === companyFilter);
  const showQuestionDetail = view === "questions" && companyFilter !== "BOARD";
  useEffect(() => {
    if (view !== "questions" || !visibleOwner || !loaded) return;
    const linkKey = `${ownerId}|${search}|${linkHash}`;
    if (handledDeepLink.current === linkKey) return;
    const target = resolveSavedQuestionDeepLink(loaded.saved, search, linkHash);
    if (!target) return;
    handledDeepLink.current = linkKey;
    setCompanyFilter(target.companyFilter);
    setCategory("ALL");
    setQuery("");
    setDeepLinkTarget(target.questionId);
  }, [view, visibleOwner, loaded, ownerId, search, linkHash]);
  useEffect(() => {
    if (!deepLinkTarget || !showQuestionDetail || !visibleOwner) return;
    const element = document.getElementById(`saved-${deepLinkTarget}`);
    if (!element) return;
    const frame = requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      element.tabIndex = -1;
      element.focus({ preventScroll: true });
      setDeepLinkTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [deepLinkTarget, showQuestionDetail, visibleOwner, companyFilter, query, category]);
  function selectCompany(id: string) {
    setCompanyFilter(id);
    setQuery("");
    setCategory("ALL");
    if (id !== "BOARD")
      setTimeout(
        () =>
          document
            .getElementById("company-questions")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        30,
      );
  }
  const keys = (
    view === "answers"
      ? Object.keys(state.answers)
      : Object.keys(state.progress).filter(
          (key) => view !== "bookmarks" || state.progress[key].bookmarked,
        )
  ).filter((key) => {
    const question = lookup(key);
    return (
      question &&
      filterSavedQuestions(
        [{ id: key, question, note: saved.find((row) => `saved:${row.id}` === key)?.note ?? "" }],
        query,
        category,
      ).length > 0
    );
  });
  const titles = {
    questions: "회사 별 면접 관리",
    answers: "내 답변",
    bookmarks: "북마크",
    progress: "학습 현황",
  };
  const empty = view === "questions" ? visibleSaved.length === 0 : keys.length === 0;
  if (authLoading) return <LoadingState compact label="계정을 확인하는 중…" />;
  if (!configured || !ownerId)
    return (
      <section className="panel empty-state">
        <h1 className="page-heading">내 학습 기록</h1>
        <p>
          {configured
            ? "로그인하면 내 질문과 답변을 다시 볼 수 있습니다."
            : "회원 저장소 연결 설정이 필요합니다."}
        </p>
        <Link className="btn btn-primary" href="/login">
          로그인하기
        </Link>
      </section>
    );
  if (!visibleOwner)
    return (
      <section className="member-workspace">
        <h1 className="page-heading">내 학습 기록</h1>
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button className="btn btn-secondary" onClick={() => void load()}>
              다시 불러오기
            </button>
          </div>
        ) : (
          <LoadingState compact label="내 기록을 불러오는 중…" />
        )}
      </section>
    );
  return (
    <section className="member-workspace">
      <p className="eyebrow">MY LEARNING</p>
      <h1 className="page-heading">{titles[view]}</h1>
      <p className="muted">
        {view === "questions"
          ? "지원할 기업을 추가하고, 기업별로 나만의 면접 질문을 준비하세요."
          : "내 계정에 저장된 실제 학습 기록입니다."}
      </p>
      {loading && <LoadingState compact label="불러오는 중…" />}
      {error && (
        <div role="alert" className="panel">
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => void load()}>
            다시 불러오기
          </button>
        </div>
      )}
      {view === "questions" && (
        <CompanyBoard
          companies={companies}
          questions={saved}
          state={state}
          selected={companyFilter}
          onSelect={selectCompany}
          onChanged={() => void load()}
        />
      )}
      {showQuestionDetail && (
        <div id="company-questions" className="company-question-heading">
          <div>
            <h2>
              {selectedCompany
                ? selectedCompany.name
                : companyFilter === "UNASSIGNED"
                  ? "미분류 질문"
                  : "전체 질문"}
            </h2>
            <p>
              {selectedCompany?.position ? `${selectedCompany.position} · ` : ""}
              {visibleSaved.length}개 질문
              {companyFilter === "UNASSIGNED" ? " · 기존 질문은 여기에 보관됩니다." : ""}
            </p>
          </div>
          <div className="company-question-actions">
            {selectedCompany && (
              <Link className="btn btn-secondary" href={`/questions?company=${selectedCompany.id}`}>
                질문 학습에서 추가
              </Link>
            )}
            <button className="btn btn-secondary" onClick={() => selectCompany("BOARD")}>
              기업 보드로
            </button>
          </div>
        </div>
      )}
      {showQuestionDetail && (
        <CreateQuestionForm
          key={companyFilter}
          companies={companies}
          initialCompanyId={selectedCompany?.id ?? null}
          onCreated={() => void load()}
        />
      )}
      {view === "progress" && !loading && !error && (
        <LearningDashboard saved={saved} state={state} />
      )}
      {view !== "progress" && (view !== "questions" || showQuestionDetail) && (
        <div
          className="member-filters"
          style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "24px 0" }}
        >
          <label style={{ flex: 1, minWidth: 220 }}>
            질문 검색
            <input
              className="input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="질문, 키워드, 개인 메모 검색"
            />
          </label>
          <label>
            카테고리
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="ALL">전체 카테고리</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {view === "questions" && (
            <label>
              기업
              <select
                className="select"
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
              >
                <option value="ALL">전체 기업</option>
                <option value="UNASSIGNED">미분류</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                    {company.position ? ` · ${company.position}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {view === "questions"
        ? visibleSaved.map((row) => (
            <article
              id={`saved-${row.id}`}
              key={row.id}
              className="panel member-question-card"
              style={{ padding: 24, margin: "16px 0" }}
            >
              {editing === row.id ? (
                <SavedQuestionEditor
                  record={row}
                  companies={companies}
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSave={(payload) => mutate(`/api/me/questions/${row.id}`, "PATCH", payload)}
                />
              ) : (
                <>
                  <small className="muted">
                    {categories.find((item) => item.id === row.question.category)?.name}
                    {!isCompactManualQuestion(row.question) && ` · ${row.question.topic}`}
                  </small>
                  <h2>{row.question.question}</h2>
                  <SavedModelAnswer question={row.question} />
                  {row.note && <p style={{ whiteSpace: "pre-wrap" }}>{row.note}</p>}
                  <div className="saved-card-toolbar">
                    <label className="company-assignment">
                      기업 폴더
                      <select
                        className="select"
                        value={row.company_id ?? ""}
                        disabled={busy}
                        onChange={(event) =>
                          void mutate(`/api/me/questions/${row.id}`, "PATCH", {
                            company_id: event.target.value || null,
                          })
                        }
                      >
                        <option value="">미분류</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                            {company.position ? ` · ${company.position}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SavedQuestionControls
                      id={row.id}
                      answer={state.answers[`saved:${row.id}`]}
                      progress={state.progress[`saved:${row.id}`]}
                      busy={busy}
                      onMutate={mutate}
                    />
                    <div className="saved-card-actions">
                      <button
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => setEditing(row.id)}
                      >
                        {isCompactManualQuestion(row.question)
                          ? "질문·답변 수정"
                          : "질문·답안·메모 편집"}
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => {
                          if (confirm("이 질문과 연결된 답변·학습 기록을 삭제할까요?"))
                            void mutate(`/api/me/questions/${row.id}`, "DELETE");
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </>
              )}
            </article>
          ))
        : view !== "progress" &&
          keys.map((key) => {
            const question = lookup(key)!;
            return (
              <article
                className="panel member-question-card"
                key={key}
                style={{ padding: 24, margin: "16px 0" }}
              >
                <h2>{question.question}</h2>
                <Link
                  href={
                    key.startsWith("base:")
                      ? `/questions/${question.id}`
                      : `/my/questions#saved-${key.slice(6)}`
                  }
                >
                  질문 학습하기 →
                </Link>
                {view === "answers" ? (
                  <form
                    className="member-answer-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void mutate("/api/me/answers", "POST", {
                        question_key: key,
                        answer_text: answerDrafts[key] ?? state.answers[key] ?? "",
                      });
                    }}
                  >
                    <label className="member-answer-label" htmlFor={`answer-${key}`}>
                      작성한 답변
                    </label>
                    <textarea
                      id={`answer-${key}`}
                      rows={5}
                      disabled={busy}
                      className="textarea"
                      name="answer"
                      aria-label="내 답변"
                      value={answerDrafts[key] ?? state.answers[key] ?? ""}
                      onChange={(event) =>
                        setAnswerDrafts((previous) => ({ ...previous, [key]: event.target.value }))
                      }
                      maxLength={20000}
                    />
                    <div className="member-answer-footer">
                      <div className="member-answer-speech">
                        <SpeechInput
                          value={answerDrafts[key] ?? state.answers[key] ?? ""}
                          onChange={(value) =>
                            setAnswerDrafts((previous) => ({ ...previous, [key]: value }))
                          }
                          disabled={busy}
                        />
                      </div>
                      <div className="member-answer-buttons">
                        <button className="btn btn-primary" disabled={busy}>
                          답변 저장
                        </button>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (confirm("답변을 삭제할까요?"))
                              void mutate(
                                `/api/me/answers?question_key=${encodeURIComponent(key)}`,
                                "DELETE",
                              );
                          }}
                        >
                          답변 삭제
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="member-learning-actions">
                    <label>
                      학습 상태
                      <select
                        className="select"
                        disabled={busy}
                        value={state.progress[key].status}
                        onChange={(event) =>
                          void mutate("/api/me/progress", "POST", {
                            question_key: key,

                            status: event.target.value,
                          })
                        }
                      >
                        {Object.entries(statusNames).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() =>
                        void mutate("/api/me/progress", "POST", {
                          question_key: key,

                          bookmarked: !state.progress[key].bookmarked,
                        })
                      }
                    >
                      {state.progress[key].bookmarked ? "북마크 해제" : "북마크 추가"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
      {!loading &&
        !error &&
        empty &&
        view !== "progress" &&
        (view !== "questions" || showQuestionDetail) && (
          <div className="panel empty-state">
            <h2>
              {query || category !== "ALL" ? "검색 결과가 없어요" : "아직 저장된 기록이 없어요"}
            </h2>
            <p className="muted">
              {query || category !== "ALL"
                ? "검색어나 카테고리를 바꿔 보세요."
                : "질문을 학습하고 나만의 답변을 남겨 보세요."}
            </p>
            <Link className="btn btn-primary" href="/questions">
              질문 둘러보기
            </Link>
          </div>
        )}
    </section>
  );
}

function SavedModelAnswer({ question }: { question: Question }) {
  if (isCompactManualQuestion(question)) {
    return (
      <div className="saved-answer-content">
        <details>
          <summary>저장한 답변 보기</summary>
          <MarkdownContent>{question.modelAnswer.interviewAnswer}</MarkdownContent>
        </details>
        {question.followUps
          .filter((item) => !item.id.startsWith("unwritten-follow-up-"))
          .map((item) => (
            <details key={item.id}>
              <summary>{item.question}</summary>
              <MarkdownContent>{item.modelAnswer}</MarkdownContent>
            </details>
          ))}
      </div>
    );
  }
  return (
    <div>
      <details>
        <summary>모범답안 보기</summary>
        {[
          ["핵심 요약", question.modelAnswer.summary],
          ["면접 답변", question.modelAnswer.interviewAnswer],
          ["상세 설명", question.modelAnswer.detailedExplanation],
          ["예시", question.modelAnswer.example],
        ].map(([title, content]) => (
          <div key={title}>
            <h3>{title}</h3>
            <MarkdownContent>{content}</MarkdownContent>
          </div>
        ))}
        <p className="muted">{question.modelAnswer.keywords.join(" · ")}</p>
      </details>
      {question.followUps.map((followup) => (
        <details key={followup.id}>
          <summary>{followup.question}</summary>
          <details>
            <summary>꼬리질문 답안 보기</summary>
            <MarkdownContent>{followup.modelAnswer}</MarkdownContent>
          </details>
        </details>
      ))}
    </div>
  );
}
