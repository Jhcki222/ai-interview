"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Search,
  SearchX,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Undo2,
  Check,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { QuestionCard, statusLabels } from "@/components/questions/question-card";
import { questions, categories } from "@/lib/questions";
import { resolveBookmarks, filterBookmarks, type BookmarkEntry } from "@/lib/learning/bookmarks";
import type { SavedQuestionRecord, MemberLearningState } from "@/lib/auth/member-learning";
import type { Progress } from "@/types/question";
import "@/components/questions/questions.css";
import "./bookmarks.css";
type Loaded = { owner: string; saved: SavedQuestionRecord[]; learning: MemberLearningState };
export function BookmarkWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const owner = user?.id ?? null;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const dataRef = useRef(loaded);
  dataRef.current = loaded;
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const locks = useRef(new Set<string>());
  const operations = useRef(new Set<AbortController>());
  const [undo, setUndo] = useState<BookmarkEntry | null>(null);
  useEffect(() => {
    setError("");
    setNotice("");
    setUndo(null);
    setDrafts({});
    setPending(new Set());
    locks.current.clear();
    for (const op of operations.current) op.abort();
    operations.current.clear();
    if (!owner) {
      setLoading(false);
      setLoaded(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      fetch("/api/me/state", {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        cache: "no-store",
      }),
      fetch("/api/me/questions", {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        cache: "no-store",
      }),
    ])
      .then(async (responses) => {
        const [learning, saved] = await Promise.all(responses.map((response) => response.json()));
        if (responses.some((response) => !response.ok))
          throw new Error(learning.error || saved.error || "북마크를 불러오지 못했어요.");
        if (!controller.signal.aborted && ownerRef.current === owner)
          setLoaded({ owner, learning, saved: saved.questions ?? [] });
      })
      .catch((e) => {
        if (!controller.signal.aborted && ownerRef.current === owner)
          setError(e instanceof Error ? e.message : "북마크를 불러오지 못했어요.");
      })
      .finally(() => {
        if (!controller.signal.aborted && ownerRef.current === owner) setLoading(false);
      });
    return () => {
      controller.abort();
      for (const op of operations.current) op.abort();
      operations.current.clear();
    };
  }, [owner, reload]);
  const own = loaded?.owner === owner ? loaded : null;
  const entries = useMemo(
    () => (own ? resolveBookmarks(questions, own.saved, own.learning) : []),
    [own],
  );
  const filtered = useMemo(
    () => filterBookmarks(entries, { query, category, status, source }),
    [entries, query, category, status, source],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  useEffect(() => setPage(1), [query, category, status, source]);
  useEffect(() => setPage((p) => Math.min(p, pages)), [pages]);
  async function api(path: string, body: unknown, method = "POST") {
    const requestOwner = owner;
    const controller = new AbortController();
    operations.current.add(controller);
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      });
      const result = await response.json();
      if (ownerRef.current !== requestOwner || controller.signal.aborted)
        throw new DOMException("Account changed", "AbortError");
      if (!response.ok) throw new Error(result.error || "변경하지 못했어요. 다시 시도해 주세요.");
      return result;
    } finally {
      operations.current.delete(controller);
    }
  }
  async function changeProgress(entry: BookmarkEntry, patch: Partial<Progress>) {
    if (!owner || !own || locks.current.has(entry.key)) return;
    const requestOwner = owner;
    locks.current.add(entry.key);
    setPending(new Set(locks.current));
    setError("");
    setNotice("");
    if (patch.bookmarked !== true) setUndo(null);
    const before = dataRef.current?.learning.progress[entry.key] ?? entry.progress;
    setLoaded((previous) =>
      previous?.owner === requestOwner
        ? {
            ...previous,
            learning: {
              ...previous.learning,
              progress: { ...previous.learning.progress, [entry.key]: { ...before, ...patch } },
            },
          }
        : previous,
    );
    try {
      const result = await api("/api/me/progress", { question_key: entry.key, ...patch });
      if (result.progress)
        setLoaded((previous) =>
          previous?.owner === requestOwner
            ? {
                ...previous,
                learning: {
                  ...previous.learning,
                  progress: {
                    ...previous.learning.progress,
                    [entry.key]: {
                      status: result.progress.status,
                      bookmarked: result.progress.bookmarked,
                    },
                  },
                },
              }
            : previous,
        );
      if (patch.bookmarked === false) {
        setUndo(entry);
        setNotice("북마크에서 제외했어요. 질문과 답변은 그대로 보관됩니다.");
      } else {
        setNotice(
          patch.bookmarked === true ? "북마크에 다시 추가했어요." : "학습 상태를 저장했어요.",
        );
        if (patch.bookmarked === true) setUndo(null);
      }
    } catch (e) {
      if (ownerRef.current === requestOwner) {
        setLoaded((previous) =>
          previous?.owner === requestOwner
            ? {
                ...previous,
                learning: {
                  ...previous.learning,
                  progress: { ...previous.learning.progress, [entry.key]: before },
                },
              }
            : previous,
        );
        setError(e instanceof Error ? e.message : "저장에 실패해 이전 상태로 복원했어요.");
      }
    } finally {
      locks.current.delete(entry.key);
      if (ownerRef.current === requestOwner) setPending(new Set(locks.current));
    }
  }
  async function answerAction(entry: BookmarkEntry, remove = false) {
    if (!owner || locks.current.has(entry.key)) return;
    const requestOwner = owner;
    setUndo(null);
    locks.current.add(entry.key);
    setPending(new Set(locks.current));
    setError("");
    try {
      const answer = drafts[entry.key] ?? entry.answer;
      await api(
        remove
          ? `/api/me/answers?question_key=${encodeURIComponent(entry.key)}`
          : "/api/me/answers",
        remove ? undefined : { question_key: entry.key, answer_text: answer },
        remove ? "DELETE" : "POST",
      );
      setLoaded((previous) => {
        if (previous?.owner !== requestOwner) return previous;
        const answers = { ...previous.learning.answers };
        if (remove) delete answers[entry.key];
        else answers[entry.key] = answer;
        return { ...previous, learning: { ...previous.learning, answers } };
      });
      if (remove)
        setDrafts((previous) => {
          const next = { ...previous };
          delete next[entry.key];
          return next;
        });
      setNotice(remove ? "답변을 삭제했어요." : "답변을 저장했어요.");
    } catch (e) {
      if (ownerRef.current === requestOwner)
        setError(e instanceof Error ? e.message : "답변 변경에 실패했어요.");
    } finally {
      locks.current.delete(entry.key);
      if (ownerRef.current === requestOwner) setPending(new Set(locks.current));
    }
  }
  async function saveSnapshot(entry: BookmarkEntry) {
    setUndo(null);
    try {
      const result = await api("/api/me/questions", entry.question);
      setNotice(
        result.alreadySaved
          ? "이미 내가 만든 질문에 보관한 질문이에요."
          : "내가 만든 질문에 모범답안과 함께 보관했어요.",
      );
    } catch (e) {
      if (ownerRef.current === owner)
        setError(e instanceof Error ? e.message : "질문을 보관하지 못했어요.");
    }
  }
  if (authLoading)
    return (
      <div className="bookmark-loading" role="status">
        <Loader2 className="animate-spin" size={22} />
        계정을 확인하고 있어요.
      </div>
    );
  if (!owner)
    return (
      <div className="empty-state">
        <Bookmark size={32} />
        <h1>로그인하고 북마크를 모아 보세요.</h1>
        <Button asChild>
          <Link href="/login?next=/my/bookmarks">로그인</Link>
        </Button>
      </div>
    );
  return (
    <section className="bookmarks-workspace">
      <div className="eyebrow">
        <Bookmark size={13} /> YOUR KNOWLEDGE, KEPT CLOSE
      </div>
      <div className="bookmarks-heading">
        <div>
          <h1 className="page-heading">다시 꺼내 볼, 나만의 북마크</h1>
          <p className="muted">중요한 질문을 모으고, 이해가 필요한 부분부터 차근차근 복습해요.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => setReload((v) => v + 1)}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          새로고침
        </Button>
      </div>
      <div className="bookmark-overview">
        <div>
          <Bookmark size={17} />
          <span>보관한 질문</span>
          <strong>{own ? entries.length : "—"}</strong>
        </div>
        <div>
          <span className="bookmark-dot review" />
          <span>복습 필요</span>
          <strong>
            {own ? entries.filter((item) => item.progress.status === "NEEDS_REVIEW").length : "—"}
          </strong>
        </div>
        <div>
          <span className="bookmark-dot complete" />
          <span>학습 완료</span>
          <strong>
            {own ? entries.filter((item) => item.progress.status === "COMPLETED").length : "—"}
          </strong>
        </div>
      </div>
      <div className="bookmark-toolbar">
        <label className="bookmark-search">
          <Search size={17} />
          <input
            aria-label="북마크 질문 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="질문이나 핵심 키워드를 검색하세요"
          />
        </label>
        <label>
          <span className="sr-only">카테고리</span>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">전체 카테고리</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">학습 상태</span>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">전체 학습 상태</option>
            {Object.entries(statusLabels).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="bookmark-source-tabs" role="group" aria-label="질문 출처 필터">
        {[
          { id: "", name: "전체 질문" },
          { id: "base", name: "기본 질문" },
          { id: "created", name: "내가 만든 질문" },
        ].map((tab) => (
          <button
            key={tab.id}
            aria-pressed={source === tab.id}
            className={source === tab.id ? "selected" : ""}
            onClick={() => setSource(tab.id)}
          >
            {tab.name}
          </button>
        ))}
        <span>검색 결과 {filtered.length}개</span>
      </div>
      {error && (
        <div className="learning-alert learning-error" role="alert">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={() => setReload((v) => v + 1)}>
            다시 불러오기
          </Button>
        </div>
      )}
      {notice && (
        <div className="bookmark-notice" role="status">
          <Check size={15} />
          <span>{notice}</span>
          {undo && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending.has(undo.key)}
              onClick={() => void changeProgress(undo, { bookmarked: true })}
            >
              <Undo2 size={14} />
              되돌리기
            </Button>
          )}
        </div>
      )}
      {loading && !own ? (
        <div className="bookmark-loading" role="status">
          <Loader2 size={22} className="animate-spin" />
          북마크를 불러오고 있어요.
        </div>
      ) : own && filtered.length ? (
        <div className="bookmark-list">
          {filtered.slice((page - 1) * 10, page * 10).map((entry, index) => (
            <div className="bookmark-entry" key={entry.key}>
              <div className="bookmark-entry-source">
                <span>{entry.source === "base" ? "기본 질문" : "내가 만든 질문"}</span>
                {entry.source === "created" && (
                  <Link href={`/my/questions?question=${entry.key.slice(6)}`}>
                    회사별 질문에서 관리 ↗
                  </Link>
                )}
              </div>
              <QuestionCard
                question={entry.question}
                domId={`bookmark-${entry.key.replace(":", "-")}`}
                titleHref={entry.source === "base" ? undefined : null}
                index={(page - 1) * 10 + index}
                answer={drafts[entry.key] ?? entry.answer}
                progress={entry.progress}
                busy={pending.has(entry.key) || loading}
                onEdit={(value) => setDrafts((previous) => ({ ...previous, [entry.key]: value }))}
                onSave={() => void answerAction(entry)}
                onDelete={() => void answerAction(entry, true)}
                onProgress={(patch) => void changeProgress(entry, patch)}
                onBookmark={() => void changeProgress(entry, { bookmarked: false })}
                onSaveQuestion={() => void saveSnapshot(entry)}
              />
            </div>
          ))}
        </div>
      ) : (
        !error && (
          <div className="empty-state">
            {entries.length ? <SearchX size={34} /> : <Bookmark size={34} />}
            <h2>
              {entries.length
                ? "조건에 맞는 북마크가 없어요."
                : "다시 보고 싶은 질문을 모아 보세요."}
            </h2>
            <p>
              {entries.length
                ? "검색어나 필터를 조금 바꿔 보세요."
                : "질문 옆 북마크 아이콘을 누르면 이곳에서 함께 복습할 수 있어요."}
            </p>
            {entries.length ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                  setSource("");
                  setStatus("");
                }}
              >
                필터 초기화
              </Button>
            ) : (
              <Button asChild>
                <Link href="/questions">
                  질문 둘러보기 <ArrowRight size={14} />
                </Link>
              </Button>
            )}
          </div>
        )
      )}
      {pages > 1 && (
        <nav className="pagination" aria-label="북마크 페이지">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ArrowLeft size={14} />
            이전
          </Button>
          <span>
            {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
            <ArrowRight size={14} />
          </Button>
        </nav>
      )}
    </section>
  );
}
