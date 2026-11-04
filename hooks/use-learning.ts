"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  GUEST_LEARNING_KEY,
  restoreGuestLearning,
  importableAnswers,
  importableProgress,
  canMutateLearning,
  type LearningData,
} from "@/lib/learning/session";
import type { Progress, Question } from "@/types/question";
import { buildImportBatches } from "@/lib/learning/import";
const empty = (): LearningData => ({ answers: {}, progress: {} });
export function useLearning() {
  const { user, loading: authLoading } = useAuth();
  const [guest, setGuest] = useState<LearningData>(empty);
  const [member, setMember] = useState<LearningData & { owner: string | null; hydrated: boolean }>(
    () => ({
      ...empty(),
      owner: null,
      hydrated: false,
    }),
  );
  const [drafts, setDrafts] = useState<{ owner: string | null; answers: Record<string, string> }>({
    owner: null,
    answers: {},
  });
  const identity = user?.id ?? null;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const mutations = useRef(new Set<AbortController>());
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => {
    try {
      setGuest(restoreGuestLearning(sessionStorage.getItem(GUEST_LEARNING_KEY)));
    } catch {
      setError("브라우저 임시 저장을 사용할 수 없어요. 탭을 닫기 전에 답변을 복사해 주세요.");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        sessionStorage.setItem(GUEST_LEARNING_KEY, JSON.stringify(guest));
      } catch {
        setError("임시 저장 공간이 부족해요. 답변을 복사하거나 로그인 후 저장해 주세요.");
      }
    }
  }, [guest, ready]);
  useEffect(() => {
    identityRef.current = identity;
    for (const request of mutations.current) request.abort();
    mutations.current.clear();
    setMember((previous) =>
      previous.owner === identity
        ? { ...previous, hydrated: false }
        : { ...empty(), owner: identity, hydrated: false },
    );
    setDrafts((previous) =>
      previous.owner === identity ? previous : { owner: identity, answers: {} },
    );
    setError("");
    setNotice("");
    setBusy(null);
    if (!user) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/me/state", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "학습 정보를 불러오지 못했어요.");
        if (!controller.signal.aborted && identityRef.current === identity)
          setMember({
            owner: identity,
            hydrated: true,
            answers: data.answers ?? {},
            progress: data.progress ?? {},
          });
      })
      .catch((e) => {
        if (!controller.signal.aborted && identityRef.current === identity) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted && identityRef.current === identity) setLoading(false);
      });
    return () => {
      controller.abort();
      for (const request of mutations.current) request.abort();
      mutations.current.clear();
      identityRef.current = null;
    };
  }, [user?.id, reloadToken]);
  async function request(url: string, body: unknown, method = "POST", owner = identity) {
    if (!owner || identityRef.current !== owner)
      throw new DOMException("Account changed", "AbortError");
    const controller = new AbortController();
    mutations.current.add(controller);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      });
      const data = await response.json();
      if (identityRef.current !== owner) throw new DOMException("Account changed", "AbortError");
      if (!response.ok) throw new Error(data.error || "저장하지 못했어요. 다시 시도해 주세요.");
      return data;
    } finally {
      mutations.current.delete(controller);
    }
  }
  const activeMember = member.owner === identity ? member : empty();
  const memberReady = canMutateLearning(identity, member.owner, member.hydrated);
  const loaded = ready && !authLoading && !loading && (!user || memberReady);
  const data = user ? activeMember : guest;
  const answers = { ...data.answers, ...(user && drafts.owner === identity ? drafts.answers : {}) };
  function editAnswer(key: string, value: string) {
    setNotice("");
    if (user)
      setDrafts((previous) => ({
        owner: identity,
        answers: { ...(previous.owner === identity ? previous.answers : {}), [key]: value },
      }));
    else setGuest((previous) => ({ ...previous, answers: { ...previous.answers, [key]: value } }));
  }
  async function saveAnswer(key: string) {
    if (!user || !loaded) return false;
    setBusy(key);
    setError("");
    try {
      const text = answers[key] ?? "";
      await request("/api/me/answers", { question_key: key, answer_text: text });
      setMember((previous) => ({ ...previous, answers: { ...previous.answers, [key]: text } }));
      setNotice("답변을 내 계정에 저장했어요.");
      return true;
    } catch (e) {
      if (identityRef.current === identity)
        setError(e instanceof Error ? e.message : "저장에 실패했어요.");
      return false;
    } finally {
      if (identityRef.current === identity) setBusy(null);
    }
  }
  async function deleteAnswer(key: string) {
    if (!user) {
      setGuest((previous) => {
        const next = { ...previous.answers };
        delete next[key];
        return { ...previous, answers: next };
      });
      return;
    }
    if (!loaded) return;
    setBusy(key);
    setError("");
    try {
      await request(`/api/me/answers?question_key=${encodeURIComponent(key)}`, undefined, "DELETE");
      setMember((previous) => {
        const next = { ...previous.answers };
        delete next[key];
        return { ...previous, answers: next };
      });
      setDrafts((previous) => {
        const next = { ...previous.answers };
        delete next[key];
        return { ...previous, answers: next };
      });
      setNotice("답변을 삭제했어요.");
    } catch (e) {
      if (identityRef.current === identity)
        setError(e instanceof Error ? e.message : "삭제에 실패했어요.");
    } finally {
      if (identityRef.current === identity) setBusy(null);
    }
  }
  async function updateProgress(key: string, patch: Partial<Progress>) {
    if (user && !loaded) return;
    const current = data.progress[key] ?? { status: "NOT_STARTED" as const, bookmarked: false };
    const next = { ...current, ...patch };
    if (!user) {
      setGuest((previous) => ({ ...previous, progress: { ...previous.progress, [key]: next } }));
      setNotice("현재 탭에 학습 상태를 임시 보관했어요.");
      return;
    }
    setBusy(key);
    setError("");
    try {
      await request("/api/me/progress", { question_key: key, ...patch });
      setMember((previous) => ({ ...previous, progress: { ...previous.progress, [key]: next } }));
      setNotice("학습 상태를 저장했어요.");
    } catch (e) {
      if (identityRef.current === identity)
        setError(e instanceof Error ? e.message : "학습 상태 저장에 실패했어요.");
    } finally {
      if (identityRef.current === identity) setBusy(null);
    }
  }
  async function saveQuestion(question: Question) {
    if (!user) return false;
    setBusy(`base:${question.id}`);
    setError("");
    try {
      const result = await request("/api/me/questions", question);
      setNotice(
        result.alreadySaved
          ? "이미 내 질문 리스트에 저장한 질문이에요."
          : "모범답안과 꼬리질문을 내 질문 리스트에 저장했어요.",
      );
      return true;
    } catch (e) {
      if (identityRef.current === identity)
        setError(e instanceof Error ? e.message : "질문 저장에 실패했어요.");
      return false;
    } finally {
      if (identityRef.current === identity) setBusy(null);
    }
  }
  const importable = user && loaded ? importableAnswers(guest.answers, activeMember.answers) : [];
  const progressToImport =
    user && loaded ? importableProgress(guest.progress, activeMember.progress) : [];
  const importableCount = new Set([
    ...importable.map(([key]) => key),
    ...progressToImport.map(([key]) => key),
  ]).size;
  async function importGuest() {
    if (!user || !loaded) return;
    setBusy("import");
    setError("");
    try {
      const batches = buildImportBatches(
        Object.fromEntries(importable),
        Object.fromEntries(progressToImport),
      );
      for (const batch of batches) {
        const result = await request("/api/me/import", batch);
        const actual = await request("/api/me/state", undefined, "GET");
        setMember({
          owner: identity,
          hydrated: true,
          answers: actual.answers ?? {},
          progress: actual.progress ?? {},
        });
        setGuest((previous) => {
          const answers = { ...previous.answers },
            progress = { ...previous.progress };
          for (const key of result.insertedAnswers ?? []) delete answers[key];
          for (const key of result.insertedProgress ?? []) delete progress[key];
          return { answers, progress };
        });
      }
      setNotice("임시 답변과 학습 기록을 계정으로 가져왔어요.");
    } catch (e) {
      if (identityRef.current === identity)
        setError(
          e instanceof Error ? e.message : "가져오기에 실패했어요. 남은 답변은 임시 보관됩니다.",
        );
    } finally {
      if (identityRef.current === identity) setBusy(null);
    }
  }
  return {
    answers,
    progress: data.progress,
    loaded,
    reload: () => setReloadToken((value) => value + 1),
    busy,
    error,
    notice,
    editAnswer,
    saveAnswer,
    deleteAnswer,
    updateProgress,
    saveQuestion,
    importableCount,
    importGuest,
  };
}
