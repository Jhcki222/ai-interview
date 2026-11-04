"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ListFilter,
  SearchX,
  ShieldCheck,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import {
  Book01Icon,
  Search01Icon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuestionCard, statusLabels } from "@/components/questions/question-card";
import { useLearning } from "@/hooks/use-learning";
import { categories, difficultyLabels, filterQuestions, importanceLabels } from "@/lib/questions";
import { cn } from "@/lib/utils";
import type { Question } from "@/types/question";
import "./questions.css";
interface Props {
  questions: Question[];
  initialCategory?: string;
  initialQuery?: string;
  detail?: Question;
}
export function QuestionWorkspace({
  questions,
  initialCategory = "",
  initialQuery = "",
  detail,
}: Props) {
  const { user } = useAuth();
  const learning = useLearning();
  const [category, setCategory] = useState(initialCategory);
  const [subcategory, setSubcategory] = useState("");
  const [query, setQuery] = useState(initialQuery);
  const [difficulty, setDifficulty] = useState("");
  const [importance, setImportance] = useState("");
  const [status, setStatus] = useState("");
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const [page, setPage] = useState(1);
  const [authOpen, setAuthOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [skipImport, setSkipImport] = useState(false);
  useEffect(() => {
    setCategory(initialCategory);
    setSubcategory("");
    setQuery(initialQuery);
  }, [initialCategory, initialQuery]);
  const filtered = useMemo(
    () =>
      filterQuestions(questions, { category, subcategory, query, difficulty, importance }).filter(
        (q) =>
          (!status || (learning.progress[`base:${q.id}`]?.status ?? "NOT_STARTED") === status) &&
          (!onlyBookmarks || learning.progress[`base:${q.id}`]?.bookmarked),
      ),
    [
      questions,
      category,
      subcategory,
      query,
      difficulty,
      importance,
      status,
      onlyBookmarks,
      learning.progress,
    ],
  );
  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    setPage((current) => Math.min(current, pages));
  }, [pages]);
  const visible = detail ? [detail] : filtered.slice((page - 1) * pageSize, page * pageSize);
  const selectedCategory = categories.find((c) => c.id === category);
  const subcategories = [
    ...new Set(
      questions.filter((q) => !category || q.category === category).map((q) => q.subcategory),
    ),
  ];
  const completed = questions.filter(
    (q) => learning.progress[`base:${q.id}`]?.status === "COMPLETED",
  ).length;
  useEffect(() => {
    setPage(1);
  }, [category, subcategory, query, difficulty, importance, status, onlyBookmarks]);
  useEffect(() => {
    if (detail) return;
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (query) params.set("q", query);
    const url = params.size ? `/questions?${params}` : "/questions";
    window.history.replaceState(null, "", url);
  }, [category, query, detail]);
  function chooseCategory(value: string) {
    setCategory(value);
    setSubcategory("");
    setCategoryOpen(false);
  }
  const reset = () => {
    setQuery("");
    setDifficulty("");
    setImportance("");
    setStatus("");
    setOnlyBookmarks(false);
    setSubcategory("");
  };
  return (
    <div className="questions-page">
      <div className="eyebrow">
        <HugeiconsIcon icon={Book01Icon} size={14} /> BUILD YOUR KNOWLEDGE
      </div>
      <div className="questions-page-title">
        <div>
          <h1 className="page-heading">
            {detail ? "질문 깊이 살펴보기" : "질문으로 쌓는, 탄탄한 기본기"}
          </h1>
          <p className="muted">
            {detail
              ? "개념을 이해하고, 나만의 언어로 설명하는 연습을 해 보세요."
              : "한 질문씩 이해하고 설명하며, 면접에서 꺼내 쓸 실력을 만들어 보세요."}
          </p>
        </div>
        <span className="question-total">
          <span>{questions.length}</span>개 질문 · 7개 분야
        </span>
      </div>
      {detail ? (
        <Link className="back-to-questions" href={`/questions?category=${detail.category}`}>
          <ArrowLeft size={14} />
          질문 목록으로 돌아가기
        </Link>
      ) : null}
      <div className={cn("question-layout", detail && "detail-layout")}>
        {!detail && (
          <aside className={cn("question-categories", categoryOpen && "category-open")}>
            <button
              className="category-mobile-toggle"
              aria-expanded={categoryOpen}
              onClick={() => setCategoryOpen(!categoryOpen)}
            >
              <ListFilter size={17} />
              {selectedCategory?.name ?? "전체 카테고리"}
              <ChevronDown size={15} />
            </button>
            <div className="category-menu">
              <div className="category-heading">
                카테고리<span>TOPICS</span>
              </div>
              <button
                className={cn("question-category", !category && "selected")}
                onClick={() => chooseCategory("")}
              >
                <span className="category-symbol">
                  <HugeiconsIcon icon={Book01Icon} size={15} />
                </span>
                전체 질문<span>{questions.length}</span>
              </button>
              {categories.map((c, index) => (
                <div key={c.id}>
                  <button
                    className={cn("question-category", category === c.id && "selected")}
                    onClick={() => chooseCategory(c.id)}
                  >
                    <span className={`category-symbol category-symbol-${index}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {c.name}
                    <span>{questions.filter((q) => q.category === c.id).length}</span>
                  </button>
                  {category === c.id && (
                    <div className="subcategory-list">
                      <button
                        className={cn(!subcategory && "selected")}
                        onClick={() => setSubcategory("")}
                      >
                        전체 보기
                      </button>
                      {subcategories.map((sub) => (
                        <button
                          key={sub}
                          className={cn(subcategory === sub && "selected")}
                          onClick={() => setSubcategory(sub)}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="category-progress">
                <span>
                  <span className="progress-dot" />
                  나의 학습 여정
                </span>
                <strong>
                  {completed}
                  <small> / {questions.length} 완료</small>
                </strong>
                <div className="mini-progress">
                  <span style={{ width: `${(completed / questions.length) * 100}%` }} />
                </div>
                <p>
                  {user
                    ? "차근차근 쌓이는 나만의 실력"
                    : "로그인하면 학습 기록을 이어갈 수 있어요."}
                </p>
              </div>
            </div>
          </aside>
        )}
        <div className="questions-main">
          {!detail && (
            <>
              <div className="question-searchbar">
                <HugeiconsIcon icon={Search01Icon} size={18} />
                <label className="sr-only" htmlFor="question-search">
                  질문과 키워드 검색
                </label>
                <input
                  id="question-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="어떤 개념이 궁금한가요? 질문과 키워드 검색"
                />
                {query && (
                  <button onClick={() => setQuery("")} aria-label="검색어 지우기">
                    <X size={15} />
                  </button>
                )}
                <span className="search-key">검색</span>
              </div>
              <div className="question-filterbar">
                <div className="filter-selects">
                  <label className="sr-only" htmlFor="difficulty-filter">
                    난이도
                  </label>
                  <select
                    id="difficulty-filter"
                    className="filter-select"
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value)}
                  >
                    <option value="">모든 난이도</option>
                    {Object.entries(difficultyLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor="importance-filter">
                    중요도
                  </label>
                  <select
                    id="importance-filter"
                    className="filter-select"
                    value={importance}
                    onChange={(event) => setImportance(event.target.value)}
                  >
                    <option value="">모든 중요도</option>
                    {Object.entries(importanceLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    className={cn("filter-button", (status || onlyBookmarks) && "selected")}
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    aria-expanded={filtersOpen}
                  >
                    <HugeiconsIcon icon={SlidersHorizontalIcon} size={14} />
                    학습 필터
                  </button>
                </div>
                <span className="filter-result">
                  총 <strong>{filtered.length}</strong>개 질문
                </span>
              </div>
              {filtersOpen && (
                <div className="extended-filters">
                  <label htmlFor="learning-status-filter">학습 상태</label>
                  <select
                    id="learning-status-filter"
                    className="filter-select"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="">전체 상태</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label className="bookmark-filter">
                    <input
                      type="checkbox"
                      checked={onlyBookmarks}
                      onChange={(e) => setOnlyBookmarks(e.target.checked)}
                    />
                    북마크만 보기
                  </label>
                  <button className="reset-filters" onClick={reset}>
                    필터 초기화
                  </button>
                </div>
              )}
              <div className="questions-section-heading">
                <h2>{subcategory || selectedCategory?.name || "전체 질문"}</h2>
                <span>
                  {selectedCategory?.description ?? "지금 궁금한 질문부터 하나씩 시작해 보세요."}
                </span>
              </div>
            </>
          )}
          {learning.error && (
            <div className="learning-alert learning-error" role="alert">
              {learning.error}
            </div>
          )}
          {learning.notice && (
            <div className="learning-alert learning-success" role="status">
              <Check size={15} />
              {learning.notice}
            </div>
          )}
          {user && learning.loaded && learning.importableCount > 0 && !skipImport && (
            <div className="guest-import">
              <div>
                <strong>로그인 전의 임시 학습 기록 {learning.importableCount}건이 있어요.</strong>
                <p>기존 답변과 상태를 덮어쓰지 않고 계정에 가져올 수 있어요.</p>
              </div>
              <Button
                size="sm"
                onClick={() => void learning.importGuest()}
                disabled={learning.busy === "import"}
              >
                가져오기
              </Button>
              <button
                className="btn btn-ghost btn-icon"
                aria-label="나중에 가져오기"
                onClick={() => setSkipImport(true)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="question-list">
            {visible.map((q, index) => {
              const key = `base:${q.id}`;
              const busy = learning.busy === key;
              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.2) }}
                >
                  <QuestionCard
                    question={q}
                    index={(page - 1) * pageSize + index}
                    answer={learning.answers[key] ?? ""}
                    progress={learning.progress[key]}
                    busy={busy}
                    detail={!!detail}
                    onEdit={(value) => learning.editAnswer(key, value)}
                    onSave={() => {
                      if (!user) {
                        setAuthOpen(true);
                        return;
                      }
                      void learning.saveAnswer(key);
                    }}
                    onDelete={() => void learning.deleteAnswer(key)}
                    onProgress={(patch) => void learning.updateProgress(key, patch)}
                    onBookmark={() => {
                      if (!user) {
                        setAuthOpen(true);
                        return;
                      }
                      void learning.updateProgress(key, {
                        bookmarked: !learning.progress[key]?.bookmarked,
                      });
                    }}
                    onSaveQuestion={() => {
                      if (!user) {
                        setAuthOpen(true);
                        return;
                      }
                      void learning.saveQuestion(q);
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
          {!visible.length && (
            <div className="empty-state">
              <SearchX size={34} />
              <h2>일치하는 질문이 없어요.</h2>
              <p>다른 키워드로 검색하거나 필터를 바꿔 보세요.</p>
              <Button variant="secondary" onClick={reset}>
                검색과 필터 초기화
              </Button>
            </div>
          )}
          {!detail && pages > 1 && (
            <nav className="pagination" aria-label="질문 페이지">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => {
                  setPage(page - 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <ArrowLeft size={14} />
                이전
              </Button>
              <span>
                <strong>{page}</strong> / {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pages}
                onClick={() => {
                  setPage(page + 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                다음
                <ArrowRight size={14} />
              </Button>
            </nav>
          )}
          <div className="learning-footnote">
            <ShieldCheck size={14} />
            {user
              ? "학습 기록과 답변은 내 계정에 안전하게 저장됩니다."
              : "비회원 답변은 현재 탭에 임시 보관돼요. 로그인하면 계정에 저장할 수 있어요."}
          </div>
        </div>
      </div>
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <span className="login-dialog-icon">
              <HugeiconsIcon icon={Book01Icon} size={25} />
            </span>
            <DialogTitle>배움을 나만의 기록으로 남겨요.</DialogTitle>
            <DialogDescription>
              질문과 답변을 저장하려면 로그인이 필요합니다.
              <br />
              작성 중인 답변은 현재 탭에 임시 보관되어 있어요.
            </DialogDescription>
          </DialogHeader>
          <div className="login-dialog-benefits">
            <span>
              <Check size={14} /> 나만의 질문과 답변 보관
            </span>
            <span>
              <Check size={14} /> 북마크와 학습 현황 관리
            </span>
            <span>
              <Check size={14} /> AI 면접 질문 저장
            </span>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAuthOpen(false)}>
              나중에 하기
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/signup?next=${encodeURIComponent(detail ? `/questions/${detail.id}` : "/questions")}`}
              >
                회원가입
              </Link>
            </Button>
            <Button asChild>
              <Link
                href={`/login?next=${encodeURIComponent(detail ? `/questions/${detail.id}` : "/questions")}`}
              >
                로그인 <ArrowRight size={14} />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
