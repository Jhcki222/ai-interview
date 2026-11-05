"use client";
import ThoughtLine from "@/components/ui/ThoughtLine";
import { LoadingState } from "@/components/ui/loading-state";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { z } from "zod";
import { useAuth } from "@/components/auth/auth-provider";
import {
  analysisSchema,
  evaluationSchema,
  followupSchema,
  generationSchema,
  summarySchema,
  type Analysis,
  type Evaluation,
  MAX_JOB_POSTING_CHARS,
  type Settings,
  type Summary,
} from "@/lib/ai/schemas";
import { type Phase, restoreSession, transition } from "@/lib/ai/state";
import { requestAI } from "@/lib/ai/client";
import { buildSummaryRequest } from "@/lib/ai/summary";
import { buildConversationRequest } from "@/lib/ai/conversation";
import { namespaceQuestions } from "@/lib/ai/question-identity";
import { extractDocuments } from "@/lib/documents/extract";
import { validateFiles } from "@/lib/documents/limits";
import type { Question } from "@/types/question";
import "./interview.css";
import { INDUSTRIES, JOB_GROUPS } from "@/lib/interview/job-catalog";
import { ModelPicker } from "./model-picker";
import { QuestionCompanyDialog } from "@/components/auth/question-company-dialog";
import { SpeechInput } from "@/components/ui/speech-input";
import type { Selection } from "@/lib/ai/catalog";
import type { AIStatus } from "@/lib/ai/reliability";
const initialSettings: Settings = {
  role: "백엔드 개발자",
  level: "신입",
  count: 5,
  mode: "chat",
  company: "",
  industry: "",
  division: "",
  jobPosting: "",
  interviewType: "comprehensive",
  difficulty: "INTERMEDIATE",
};
const blankAnalysis: Analysis = { summary: "", skills: [], experiences: [], uncertainties: [] };
type Turn = { question: string; answer: string; evaluation: Evaluation };
const SESSION_KEY = "interview-session-v1";
export function InterviewWorkspace({ requestedSessionId }: { requestedSessionId?: string }) {
  const [customRoleMode, setCustomRoleMode] = useState(false);
  const [questionToSave, setQuestionToSave] = useState<Question | null>(null);
  const [selection, setSelection] = useState<Selection>();
  const [allowFallback, setAllowFallback] = useState(true);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [statusHistory, setStatusHistory] = useState<AIStatus[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [unmatched, setUnmatched] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [learningAnswers, setLearningAnswers] = useState<Record<string, string>>({});
  const [learningEvaluations, setLearningEvaluations] = useState<Record<string, Evaluation>>({});
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("SETUP");
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [files, setFiles] = useState<File[]>([]);
  const [jobPostingFiles, setJobPostingFiles] = useState<File[]>([]);
  const [jobPostingDragging, setJobPostingDragging] = useState(false);
  const [context, setContext] = useState("");
  const [analysis, setAnalysis] = useState<Analysis>(blankAnalysis);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [followup, setFollowup] = useState<z.infer<typeof followupSchema> | null>(null);
  const [followupCount, setFollowupCount] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const running = useRef(false);
  const retry = useRef<(() => void) | null>(null);
  const attempts = useRef(0);
  const move = (next: Phase) => setPhase((current) => transition(current, next));
  useEffect(() => {
    try {
      const restored = restoreSession(sessionStorage.getItem(SESSION_KEY), requestedSessionId);
      if (restored) {
        setSessionId(restored.id || crypto.randomUUID());
        setPhase(restored.phase);
        setSettings(restored.settings);
        setSelection(restored.selection);
        setAllowFallback(restored.allowFallback);
        setAnalysis(restored.analysis);
        setQuestions(restored.questions);
        setIndex(restored.index);
        setTurns(restored.turns);
        setSummary(restored.summary);
        setDraft(restored.draft);
        setFollowup(restored.followup);
        setFollowupCount(restored.followupCount);
        setLearningAnswers(restored.learningAnswers);
        setLearningEvaluations(restored.learningEvaluations);
        setNotice("이 탭의 면접 진행을 복원했습니다. 원본 문서는 저장되지 않습니다.");
      } else if (requestedSessionId) setUnmatched(true);
      else setSessionId(crypto.randomUUID());
    } catch {
      if (requestedSessionId) setUnmatched(true);
      setNotice("브라우저 임시 저장소를 사용할 수 없습니다. 진행은 이 화면에서만 유지됩니다.");
      if (!requestedSessionId) setSessionId(crypto.randomUUID());
    }
    setReady(true);
    return () => controller.current?.abort();
  }, [requestedSessionId]);
  useEffect(() => {
    if (!ready || unmatched) return;
    const stable = ["REVIEW", "LEARNING", "ANSWERING", "FEEDBACK", "COMPLETED"];
    if (!stable.includes(phase)) return;
    try {
      const value = {
        version: 1,
        selection,
        allowFallback,
        id: sessionId,
        learningAnswers,
        learningEvaluations,
        phase,
        settings,
        analysis,
        questions,
        index,
        turns,
        summary,
        draft,
        followup,
        followupCount,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    } catch {
      setNotice("브라우저 저장 공간 부족으로 진행을 복원할 수 없습니다.");
    }
  }, [
    selection,
    allowFallback,
    ready,
    unmatched,
    sessionId,
    learningAnswers,
    learningEvaluations,
    phase,
    settings,
    analysis,
    questions,
    index,
    turns,
    summary,
    draft,
    followup,
    followupCount,
  ]);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  function handleStatus(value: AIStatus) {
    setAIStatus(value);
    setStatusHistory((previous) =>
      value.state === "initializing" ? [value] : [...previous.slice(-9), value],
    );
    if (["connecting", "retrying", "fallback"].includes(value.state)) setPreview("");
  }
  async function run<T>(
    body: unknown,
    schema: z.ZodType<T>,
    during: Phase,
    fallback: Phase,
    success: (value: T) => void,
  ) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setPreview("");
    move(during);
    controller.current = new AbortController();
    const timeout = setTimeout(
      () => controller.current?.abort(new DOMException("Request timeout", "TimeoutError")),
      115000,
    );
    try {
      const result = await requestAI(
        body,
        schema,
        controller.current.signal,
        setProgress,
        setPreview,
        { selection, allowFallback, onStatus: handleStatus },
      );
      success(result);
      retry.current = null;
      attempts.current = 0;
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "AbortError"
          ? e.message
          : "요청이 취소되었거나 제한 시간을 초과했습니다.",
      );
      move(fallback);
      retry.current = () => {
        void run(body, schema, during, fallback, success);
      };
    } finally {
      clearTimeout(timeout);
      running.current = false;
      setBusy(false);
      setProgress("");
      setPreview("");
      controller.current = null;
    }
  }
  async function analyze() {
    if (running.current) return;
    setError("");
    const extractionController = new AbortController();
    const timeout = setTimeout(() => extractionController.abort(), 60000);
    try {
      validateFiles(files);
      validateFiles(jobPostingFiles);
      if (!files.length && !context.trim())
        throw new Error("문서를 첨부하거나 경력·프로젝트 설명을 입력해 주세요.");
      controller.current = extractionController;
      running.current = true;
      setBusy(true);
      setProgress("문서에서 텍스트를 추출하고 있습니다.");
      const extracted = await extractDocuments(files, extractionController.signal, setProgress);
      const extractedJobPosting = await extractDocuments(
        jobPostingFiles,
        extractionController.signal,
        setProgress,
      );
      extractionController.signal.throwIfAborted();
      if (controller.current !== extractionController)
        throw new DOMException("취소되었습니다.", "AbortError");
      const documents = [extracted, context].filter(Boolean).join("\n\n");
      const jobPosting = [settings.jobPosting.trim(), extractedJobPosting.trim()]
        .filter(Boolean)
        .join("\n\n");
      if (jobPosting.length > MAX_JOB_POSTING_CHARS)
        throw new Error(
          `채용공고 텍스트는 최대 ${MAX_JOB_POSTING_CHARS.toLocaleString()}자까지 사용할 수 있습니다.`,
        );
      const analysisSettings = { ...settings, jobPosting };
      setSettings(analysisSettings);
      clearTimeout(timeout);
      controller.current = null;
      running.current = false;
      setBusy(false);
      setProgress("");
      await run(
        { action: "analyze", documents, settings: analysisSettings },
        analysisSchema,
        "ANALYZING",
        "SETUP",
        (value) => {
          setAnalysis(value);
          setFiles([]);
          setJobPostingFiles([]);
          setContext("");
          move("REVIEW");
        },
      );
    } catch (e) {
      running.current = false;
      setBusy(false);
      setProgress("");
      setError(
        e instanceof Error && e.name === "AbortError"
          ? "문서 추출이 취소되었거나 제한 시간을 초과했습니다."
          : e instanceof Error
            ? e.message
            : "문서를 읽지 못했습니다.",
      );
    } finally {
      clearTimeout(timeout);
      if (controller.current === extractionController) controller.current = null;
    }
  }
  function generate() {
    void run(
      { action: "generate", analysis, settings },
      generationSchema,
      "GENERATING",
      "REVIEW",
      (value) => {
        setQuestions(namespaceQuestions(value.questions, sessionId));
        setIndex(0);
        setTurns([]);
        setDraft("");
        setSummary(null);
        move(settings.mode === "learn" ? "LEARNING" : "ANSWERING");
      },
    );
  }
  const currentQuestion = followup?.question || questions[index]?.question;
  const latest = turns.at(-1);
  function evaluate() {
    if (!draft.trim() || !currentQuestion) return;
    const question = currentQuestion;
    const answer = draft;
    void run(
      buildConversationRequest("evaluate", question, answer, turns),
      evaluationSchema,
      "EVALUATING",
      "ANSWERING",
      (evaluation) => {
        setTurns((previous) => [...previous, { question, answer, evaluation }]);
        setDraft("");
        move("FEEDBACK");
      },
    );
  }
  async function askFollowup() {
    if (!latest || running.current || followupCount >= 2) return;
    running.current = true;
    setBusy(true);
    setError("");
    setPreview("");
    controller.current = new AbortController();
    const timeout = setTimeout(
      () => controller.current?.abort(new DOMException("Request timeout", "TimeoutError")),
      115000,
    );
    try {
      const value = await requestAI(
        buildConversationRequest("followup", latest.question, latest.answer, turns.slice(0, -1)),
        followupSchema,
        controller.current.signal,
        setProgress,
        setPreview,
        { selection, allowFallback, onStatus: handleStatus },
      );
      setFollowup(value);
      setFollowupCount((n) => n + 1);
      move("ANSWERING");
    } catch (e) {
      setError(e instanceof Error ? e.message : "꼬리질문을 가져오지 못했습니다.");
    } finally {
      clearTimeout(timeout);
      running.current = false;
      setBusy(false);
      setProgress("");
      setPreview("");
    }
  }
  function next() {
    setFollowup(null);
    setFollowupCount(0);
    setIndex((i) => i + 1);
    move("ANSWERING");
  }
  function finish() {
    void run(buildSummaryRequest(turns), summarySchema, "SUMMARIZING", "FEEDBACK", (value) => {
      setSummary(value);
      move("COMPLETED");
    });
  }
  function reset() {
    controller.current?.abort();
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      setNotice("브라우저 임시 저장 기록을 지우지 못했습니다.");
    }
    setSessionId(crypto.randomUUID());
    setLearningAnswers({});
    setLearningEvaluations({});
    setPhase("SETUP");
    setQuestions([]);
    setFiles([]);
    setJobPostingFiles([]);
    setContext("");
    setTurns([]);
    setDraft("");
    setSummary(null);
    setAnalysis(blankAnalysis);
    setFollowup(null);
    setFollowupCount(0);
    setError("");
    setNotice("");
    retry.current = null;
    attempts.current = 0;
    if (requestedSessionId) location.assign("/interview");
  }
  async function save(question: Question) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setQuestionToSave(question);
  }
  function saveCurrentQuestion() {
    const question = questions[index];
    if (!question) return;
    if (!followup) {
      void save(question);
      return;
    }
    const answer = followup.modelAnswer;
    void save({
      ...question,
      id: `${question.id.slice(0, 85)}-followup-${followupCount}`.slice(0, 100),
      question: followup.question,
      modelAnswer: {
        ...question.modelAnswer,
        summary: answer.slice(0, 160),
        interviewAnswer: answer.slice(0, 1000),
        detailedExplanation: answer.slice(0, 1500),
        example: answer.slice(0, 1000),
      },
      source: { type: "AI 면접 꼬리질문", evidence: followup.reason },
    });
  }
  function addFiles(incoming: File[]) {
    if (busy) return;
    const combined = [...files];
    for (const file of incoming)
      if (
        !combined.some(
          (f) =>
            f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
        )
      )
        combined.push(file);
    try {
      validateFiles(combined);
      setFiles(combined);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function addJobPostingFiles(incoming: File[]) {
    if (busy) return;
    const combined = [...jobPostingFiles];
    for (const file of incoming)
      if (
        !combined.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified,
        )
      )
        combined.push(file);
    try {
      validateFiles(combined);
      setJobPostingFiles(combined);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function evaluateLearning(question: Question) {
    if (running.current) return;
    const answer = learningAnswers[question.id];
    if (!answer?.trim()) return;
    running.current = true;
    setBusy(true);
    setError("");
    setPreview("");
    controller.current = new AbortController();
    const timeout = setTimeout(
      () => controller.current?.abort(new DOMException("Request timeout", "TimeoutError")),
      115000,
    );
    try {
      const evaluation = await requestAI(
        buildConversationRequest("evaluate", question.question, answer),
        evaluationSchema,
        controller.current.signal,
        setProgress,
        setPreview,
        { selection, allowFallback, onStatus: handleStatus },
      );
      setLearningEvaluations((previous) => ({ ...previous, [question.id]: evaluation }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "평가를 완료하지 못했습니다.");
    } finally {
      clearTimeout(timeout);
      running.current = false;
      setBusy(false);
      setProgress("");
      setPreview("");
    }
  }
  if (unmatched)
    return (
      <section className="panel empty-state">
        <h1>이 면접을 찾을 수 없습니다</h1>
        <p className="muted">
          이 주소는 현재 탭에 보관된 면접과 일치하지 않습니다. 면접 기록은 생성한 탭에서만 복원할 수
          있습니다.
        </p>
        <Link className="btn btn-primary" href="/interview">
          현재 탭의 면접으로 이동
        </Link>
      </section>
    );
  return (
    <div className="interview-workspace">
      <QuestionCompanyDialog
        question={questionToSave}
        onClose={() => setQuestionToSave(null)}
        onSaved={setNotice}
        suggestedCompanyName={settings.company}
      />
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogTitle>질문을 계정에 보관하세요</DialogTitle>
          <DialogDescription>
            로그인하면 생성한 질문과 모범답안, 꼬리질문을 내 질문에 저장할 수 있습니다. 현재 면접
            진행은 이 탭에 유지됩니다.
          </DialogDescription>
          <DialogFooter>
            <Link className="btn btn-primary" href="/login?next=/interview">
              로그인
            </Link>
            <Link className="btn btn-secondary" href="/signup?next=/interview">
              회원가입
            </Link>
            <button className="btn btn-secondary" onClick={() => setAuthOpen(false)}>
              나중에
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <header className="interview-heading">
        <div>
          <p className="eyebrow">YOUR NEXT INTERVIEW</p>
          <h1 className="page-heading">AI 면접 연습</h1>
          <p className="muted">경험을 질문으로, 답변을 실력으로. 나에게 맞는 면접을 시작하세요.</p>
        </div>
        {phase !== "SETUP" && !busy && (
          <button className="btn btn-secondary" onClick={reset}>
            새 면접
          </button>
        )}
      </header>
      <ol className="interview-steps" aria-label="면접 진행 단계">
        {["설정", "분석 확인", "질문 · 답변", "최종 피드백"].map((label, i) => (
          <li
            key={label}
            aria-current={
              (phase === "SETUP" || phase === "ANALYZING"
                ? 0
                : phase === "REVIEW" || phase === "GENERATING"
                  ? 1
                  : phase === "COMPLETED"
                    ? 3
                    : 2) === i
                ? "step"
                : undefined
            }
          >
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <ModelPicker
        selection={selection}
        onChange={setSelection}
        allowFallback={allowFallback}
        onFallbackChange={setAllowFallback}
        disabled={busy}
      />
      {aiStatus && (
        <section className="interview-ai-status" role="status">
          <ThoughtLine
            interrupted={!busy && aiStatus.state !== "completed"}
            working={busy}
            label={aiStatus.message}
            doneLabel={aiStatus.message}
            steps={statusHistory
              .map((item) => item.message)
              .filter((message, index, all) => index === 0 || message !== all[index - 1])}
            elapsed={busy ? elapsed : (aiStatus.elapsedMs || 0) / 1000}
            color="var(--primary)"
            collapseOnSettle={false}
          />
          <small>
            {aiStatus.provider && `${aiStatus.provider} · ${aiStatus.model}`} ·{" "}
            {busy ? elapsed : Math.round((aiStatus.elapsedMs || 0) / 1000)}초
            {aiStatus.attempt ? ` · 시도 ${aiStatus.attempt}` : ""}
            {aiStatus.code ? ` · ${aiStatus.code}` : ""}
            {aiStatus.correlationId ? ` · 요청 ${aiStatus.correlationId}` : ""}
            {aiStatus.retryAfterMs
              ? ` · ${Math.ceil(aiStatus.retryAfterMs / 1000)}초 후 재시도`
              : ""}
          </small>
        </section>
      )}
      {notice && (
        <div className="interview-notice" role="status">
          {notice} {!user && <Link href="/login?next=/interview">로그인</Link>}
        </div>
      )}
      {error && (
        <div className="interview-error" role="alert">
          {error}{" "}
          {retry.current && attempts.current < 2 && (
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                attempts.current++;
                retry.current?.();
              }}
            >
              다시 시도 ({2 - attempts.current}회 남음)
            </button>
          )}
        </div>
      )}
      {busy && (
        <div className="panel interview-loading" role="status">
          {!aiStatus && <LoadingState compact label={progress || "문서를 준비하고 있습니다."} />}
          {preview && (
            <div className="interview-preview">
              <small className="muted">생성 중인 미리보기 · 검증 전</small>
              <p className="interview-prewrap">{preview}</p>
            </div>
          )}
          <button className="btn btn-secondary" onClick={() => controller.current?.abort()}>
            요청 취소
          </button>
        </div>
      )}
      {phase === "SETUP" && (
        <section className="panel interview-setup">
          <div>
            <h2>어떤 면접을 준비하나요?</h2>
            <p className="muted">지원 직무와 경험을 알려주면 관련 질문을 구성합니다.</p>
          </div>
          <label>
            산업 · 기관 유형 (선택)
            <select
              className="select"
              value={settings.industry}
              onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
            >
              <option value="">선택하지 않음</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry.id} value={industry.label}>
                  {industry.label}
                </option>
              ))}
            </select>
          </label>{" "}
          <div className="interview-form-grid">
            <label>
              지원 직무
              <select
                className="select"
                value={
                  customRoleMode || !JOB_GROUPS.some((group) => group.roles.includes(settings.role))
                    ? "__custom__"
                    : settings.role
                }
                onChange={(e) => {
                  if (e.target.value === "__custom__") setCustomRoleMode(true);
                  else {
                    setCustomRoleMode(false);
                    setSettings({ ...settings, role: e.target.value });
                  }
                }}
              >
                {JOB_GROUPS.map((group) => (
                  <optgroup key={group.id} label={group.label}>
                    {group.roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="__custom__">직접 입력</option>
              </select>
              {(customRoleMode ||
                !JOB_GROUPS.some((group) => group.roles.includes(settings.role))) && (
                <input
                  className="input"
                  aria-label="지원 직무 직접 입력"
                  value={settings.role}
                  maxLength={100}
                  placeholder="지원 직무를 직접 입력하세요"
                  onChange={(e) => setSettings({ ...settings, role: e.target.value })}
                />
              )}
            </label>{" "}
            <label>
              경력 수준
              <select
                className="select"
                value={settings.level}
                onChange={(e) =>
                  setSettings({ ...settings, level: e.target.value as Settings["level"] })
                }
              >
                {["신입", "주니어", "시니어"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              질문 수
              <select
                className="select"
                value={settings.count}
                onChange={(e) =>
                  setSettings({ ...settings, count: Number(e.target.value) as Settings["count"] })
                }
              >
                {[5, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n}개
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="interview-form-grid">
            <label>
              지원 기업 (선택)
              <input
                className="input"
                value={settings.company}
                maxLength={100}
                onChange={(e) => setSettings({ ...settings, company: e.target.value })}
              />
            </label>
            <label>
              지원 부문 (선택)
              <input
                className="input"
                value={settings.division}
                maxLength={100}
                onChange={(e) => setSettings({ ...settings, division: e.target.value })}
              />
            </label>
            <label>
              난이도
              <select
                className="select"
                value={settings.difficulty}
                onChange={(e) =>
                  setSettings({ ...settings, difficulty: e.target.value as Settings["difficulty"] })
                }
              >
                <option value="BASIC">기초</option>
                <option value="INTERMEDIATE">중급</option>
                <option value="ADVANCED">심화</option>
              </select>
            </label>
          </div>
          <label>
            면접 유형
            <select
              className="select"
              value={settings.interviewType}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  interviewType: e.target.value as Settings["interviewType"],
                })
              }
            >
              {[
                ["comprehensive", "종합 면접"],
                ["technical", "기술 면접"],
                ["project", "프로젝트 면접"],
                ["personality", "인성 면접"],
                ["motivation", "지원 동기 면접"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            채용 공고 (선택)
            <textarea
              className="textarea"
              rows={4}
              value={settings.jobPosting}
              maxLength={MAX_JOB_POSTING_CHARS}
              onChange={(e) => setSettings({ ...settings, jobPosting: e.target.value })}
              placeholder="주요 업무와 자격 요건을 붙여 넣으세요."
            />
          </label>
          <div
            className={`interview-upload ${jobPostingDragging ? "is-dragging" : ""}`}
            role="group"
            aria-label="채용공고 파일 업로드"
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setJobPostingDragging(true);
            }}
            onDragLeave={() => setJobPostingDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setJobPostingDragging(false);
              addJobPostingFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <strong>채용공고 파일 추가</strong>
            <span className="muted">
              파일을 끌어 놓거나 선택하세요 · PDF, DOCX, TXT, PNG, JPG, WEBP · 최대 3개 · 파일당 5MB
            </span>
            <input
              aria-label="채용공고 파일 선택"
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
              multiple
              disabled={busy}
              onChange={(event) => {
                addJobPostingFiles(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
            {jobPostingFiles.length > 0 && (
              <ul className="interview-files">
                {jobPostingFiles.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}`}>
                    <span>
                      <strong>{file.name}</strong>
                      <small className="muted">
                        {(file.size / 1024).toFixed(1)}KB · 텍스트 추출 대기
                      </small>
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      aria-label={`${file.name} 제거`}
                      disabled={busy}
                      onClick={() =>
                        setJobPostingFiles((previous) =>
                          previous.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <fieldset className="interview-mode">
            <legend>연습 방식</legend>
            {[
              { id: "chat", name: "실전 대화", description: "한 질문씩 답하고 맞춤 피드백 받기" },
              { id: "learn", name: "질문 학습", description: "전체 질문과 모범답안 함께 살펴보기" },
            ].map((mode) => (
              <label key={mode.id} className={settings.mode === mode.id ? "selected" : ""}>
                <input
                  type="radio"
                  name="mode"
                  value={mode.id}
                  checked={settings.mode === mode.id}
                  onChange={() => setSettings({ ...settings, mode: mode.id as Settings["mode"] })}
                />
                <strong>{mode.name}</strong>
                <span className="muted">{mode.description}</span>
              </label>
            ))}
          </fieldset>
          <div
            className={`interview-upload ${dragging ? "is-dragging" : ""}`}
            role="group"
            aria-label="문서 업로드"
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <strong>이력서 · 자기소개서 · 포트폴리오</strong>
            <span className="muted">
              여기로 파일을 끌어 놓거나 선택하세요 · PDF, DOCX, TXT, PNG, JPG, WEBP · 최대 3개 ·
              파일당 5MB
            </span>
            <input
              aria-label="면접 참고 문서 선택"
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
              multiple
              disabled={busy}
              onChange={(e) => {
                addFiles(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
            {files.length > 0 && (
              <ul className="interview-files">
                {files.map((file, i) => (
                  <li key={`${file.name}-${file.lastModified}`}>
                    <span>
                      <strong>{file.name}</strong>
                      <small className="muted">
                        {(file.size / 1024).toFixed(1)}KB · {busy ? "분석 중" : "추출 준비됨"}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      aria-label={`${file.name} 제거`}
                      disabled={busy}
                      onClick={() => setFiles((previous) => previous.filter((_, n) => n !== i))}
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>{" "}
          <label>
            경험 직접 입력 (선택)
            <textarea
              className="textarea"
              rows={5}
              maxLength={12000}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="프로젝트에서 맡은 역할, 사용 기술, 해결한 문제를 알려주세요."
            />
          </label>
          <p className="muted interview-privacy">
            문서 원본은 저장하지 않습니다. 추출 내용은 분석을 위해 AI 제공자에게 전송되며, 검토한
            분석과 면접 기록은 이 탭의 세션에만 보관됩니다. 불필요한 개인정보는 제거해 주세요.
          </p>
          <button
            className="btn btn-primary"
            disabled={busy || !settings.role.trim()}
            onClick={() => void analyze()}
          >
            경험 분석하기 →
          </button>
        </section>
      )}
      {phase === "REVIEW" && (
        <section className="panel interview-setup">
          <div>
            <h2>분석 내용을 확인해 주세요</h2>
            <p className="muted">
              실제 경험과 다른 내용은 수정하세요. 아래 내용으로 질문을 생성합니다.
            </p>
          </div>
          {settings.jobPosting.trim() && (
            <label>
              질문 생성에 사용할 채용공고
              <textarea
                className="textarea"
                rows={6}
                maxLength={MAX_JOB_POSTING_CHARS}
                value={settings.jobPosting}
                onChange={(event) => setSettings({ ...settings, jobPosting: event.target.value })}
              />
            </label>
          )}
          <label>
            경험 요약
            <textarea
              className="textarea"
              rows={5}
              maxLength={8000}
              value={analysis.summary}
              onChange={(e) => setAnalysis({ ...analysis, summary: e.target.value })}
            />
          </label>
          <label>
            기술 · 역량 (쉼표로 구분)
            <input
              className="input"
              value={analysis.skills.join(", ")}
              onChange={(e) =>
                setAnalysis({
                  ...analysis,
                  skills: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .slice(0, 30),
                })
              }
            />
          </label>
          {analysis.experiences.map((experience, i) => (
            <div key={i} className="interview-evidence">
              <label>
                경험 {i + 1}
                <textarea
                  className="textarea"
                  value={experience.description}
                  maxLength={8000}
                  onChange={(e) =>
                    setAnalysis({
                      ...analysis,
                      experiences: analysis.experiences.map((x, n) =>
                        n === i ? { ...x, description: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label>
                원문 근거
                <textarea
                  className="textarea"
                  value={experience.evidence}
                  maxLength={8000}
                  onChange={(e) =>
                    setAnalysis({
                      ...analysis,
                      experiences: analysis.experiences.map((x, n) =>
                        n === i ? { ...x, evidence: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
            </div>
          ))}
          {analysis.uncertainties.length > 0 && (
            <aside className="interview-notice">
              <strong>확인할 내용 · 추론</strong>
              <ul>
                {analysis.uncertainties.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </aside>
          )}
          <button
            className="btn btn-primary"
            disabled={busy || !analysisSchema.safeParse(analysis).success}
            onClick={generate}
          >
            {settings.count}개 질문 생성하기 →
          </button>
        </section>
      )}
      {phase === "LEARNING" && (
        <div className="interview-question-list">
          <div className="interview-section-title">
            <h2>
              나를 위한 면접 질문 <span className="muted">{questions.length}</span>
            </h2>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => {
                setSettings({ ...settings, mode: "chat" });
                setIndex(0);
                setDraft("");
                setTurns([]);
                setFollowup(null);
                setFollowupCount(0);
                move("ANSWERING");
              }}
            >
              이 질문으로 실전 면접 시작 →
            </button>
          </div>
          {sessionId && (
            <Link className="muted" href={`/interview/${sessionId}`}>
              이 탭의 면접 주소
            </Link>
          )}
          {questions.map((question, i) => (
            <div key={question.id}>
              <QuestionCard
                question={question}
                number={i + 1}
                onSave={() => void save(question)}
                answer={learningAnswers[question.id] || ""}
                onEdit={(answer) => {
                  setLearningAnswers((previous) => ({ ...previous, [question.id]: answer }));
                  setLearningEvaluations((previous) => {
                    const next = { ...previous };
                    delete next[question.id];
                    return next;
                  });
                }}
                onEvaluate={() => void evaluateLearning(question)}
                busy={busy}
              />
              {learningEvaluations[question.id] && (
                <section className="panel interview-setup" aria-label={`질문 ${i + 1} AI 피드백`}>
                  <EvaluationCard evaluation={learningEvaluations[question.id]} />
                </section>
              )}
            </div>
          ))}
        </div>
      )}{" "}
      {(phase === "ANSWERING" || phase === "EVALUATING" || phase === "FEEDBACK") &&
        questions[index] && (
          <section className="interview-chat">
            <div className="panel interview-question">
              <p className="eyebrow">
                QUESTION {index + 1} / {questions.length}
                {followup ? " · 꼬리질문" : ""}
              </p>
              <h2>{currentQuestion}</h2>
              <button className="btn btn-secondary" disabled={busy} onClick={saveCurrentQuestion}>
                기업 질문에 저장
              </button>
              {followup && <p className="muted">{followup.reason}</p>}
              <div className="interview-progress-track">
                <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
              </div>
            </div>
            {phase === "ANSWERING" && (
              <div className="panel interview-setup">
                <label htmlFor="interview-answer">나의 답변</label>
                <textarea
                  id="interview-answer"
                  className="textarea"
                  rows={9}
                  value={draft}
                  maxLength={8000}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="생각을 정리해 답변해 주세요. 결론, 근거, 경험 순서로 구성하면 좋습니다."
                />
                <SpeechInput value={draft} onChange={setDraft} disabled={busy} />
                <div className="interview-actions">
                  <span className="muted">{draft.length.toLocaleString()} / 8,000자</span>
                  <button
                    className="btn btn-primary"
                    disabled={busy || !draft.trim()}
                    onClick={evaluate}
                  >
                    답변 제출 →
                  </button>
                </div>
              </div>
            )}
            {phase === "FEEDBACK" && latest && (
              <>
                <div className="panel interview-setup">
                  <h3>나의 답변</h3>
                  <p className="interview-prewrap">{latest.answer}</p>
                  <EvaluationCard evaluation={latest.evaluation} />
                  <details>
                    <summary>이 질문의 모범답안</summary>
                    <p className="interview-prewrap">
                      {followup?.modelAnswer || questions[index].modelAnswer.interviewAnswer}
                    </p>
                  </details>
                  <div className="interview-actions">
                    <button
                      className="btn btn-secondary"
                      disabled={busy || followupCount >= 2 || turns.length >= 44}
                      onClick={() => void askFollowup()}
                    >
                      꼬리질문 받기 ({followupCount}/2)
                    </button>
                    {index < questions.length - 1 ? (
                      <button className="btn btn-primary" disabled={busy} onClick={next}>
                        다음 질문 →
                      </button>
                    ) : (
                      <button className="btn btn-primary" disabled={busy} onClick={finish}>
                        최종 피드백 보기 →
                      </button>
                    )}
                  </div>
                  <button className="btn btn-secondary" disabled={busy} onClick={finish}>
                    여기서 마치고 종합 평가
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      {phase === "COMPLETED" && summary && (
        <section className="panel interview-setup">
          <p className="eyebrow">INTERVIEW COMPLETE</p>
          <h2>연습을 끝까지 해냈어요.</h2>
          <div className="interview-score">
            {Math.round(summary.overallScore)}
            <small> / 100</small>
          </div>
          <p className="muted">AI 추정 평가 · 실제 채용 결과를 예측하지 않습니다.</p>
          <p>{summary.summary}</p>
          <FeedbackList title="잘한 점" items={summary.strengths} />
          <FeedbackList title="먼저 보완할 점" items={summary.priorities} />
          <FeedbackList title="다음 학습 계획" items={summary.studyPlan} />
          <details>
            <summary>전체 답변 · 평가 기록 ({turns.length}개)</summary>
            {turns.map((turn, i) => (
              <article key={i} className="interview-transcript">
                <h3>{turn.question}</h3>
                <p className="interview-prewrap">{turn.answer}</p>
                <EvaluationCard evaluation={turn.evaluation} />
              </article>
            ))}
          </details>
          <button className="btn btn-primary" onClick={reset}>
            새 면접 시작하기
          </button>
        </section>
      )}
    </div>
  );
}
function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul className="interview-feedback-list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div>
      <div className="interview-score">
        {Math.round(evaluation.score)}
        <small> / 100</small>
      </div>
      <p className="muted">AI 추정 평가</p>
      <div className="interview-dimensions">
        {evaluation.dimensions.map((item) => (
          <div key={item.name}>
            <strong>
              {item.name} <span>{Math.round(item.score)}</span>
            </strong>
            <p>{item.evidence}</p>
          </div>
        ))}
      </div>
      <FeedbackList title="강점" items={evaluation.strengths} />
      <FeedbackList title="보완점" items={evaluation.improvements} />
      <details>
        <summary>개선된 답변 예시</summary>
        <p className="interview-prewrap">{evaluation.revisedAnswer}</p>
      </details>
    </div>
  );
}
function QuestionCard({
  question,
  number,
  onSave,
  answer,
  onEdit,
  onEvaluate,
  busy,
}: {
  question: Question;
  number: number;
  onSave: () => void;
  answer: string;
  onEdit: (value: string) => void;
  onEvaluate: () => void;
  busy: boolean;
}) {
  return (
    <article className="panel interview-setup">
      <p className="eyebrow">
        QUESTION {number} · {question.topic}
      </p>
      <h2>{question.question}</h2>
      <details>
        <summary>모범답안 보기</summary>
        <div className="interview-model-answer">
          {[
            ["핵심 요약", question.modelAnswer.summary],
            ["면접 답변", question.modelAnswer.interviewAnswer],
            ["상세 설명", question.modelAnswer.detailedExplanation],
            ["실무 예시", question.modelAnswer.example],
          ].map(([title, text]) => (
            <div key={title}>
              <h3>{title}</h3>
              <p className="interview-prewrap">{text}</p>
            </div>
          ))}
          <p className="muted">{question.modelAnswer.keywords.join(" · ")}</p>
        </div>
      </details>
      {question.followUps.map((item, i) => (
        <details key={item.id}>
          <summary>
            꼬리질문 {i + 1}: {item.question}
          </summary>
          <details>
            <summary>꼬리질문 답안 보기</summary>
            <p className="interview-prewrap">{item.modelAnswer}</p>
          </details>
        </details>
      ))}
      {question.source && (
        <details>
          <summary>질문 생성 근거</summary>
          <p>{question.source.evidence}</p>
        </details>
      )}
      <label htmlFor={`interview-question-${question.id}-answer`}>나의 답변</label>
      <textarea
        id={`interview-question-${question.id}-answer`}
        className="textarea"
        rows={6}
        maxLength={8000}
        disabled={busy}
        value={answer}
        onChange={(e) => onEdit(e.target.value)}
        placeholder="답변을 작성하고 AI 피드백을 받아보세요."
      />
      <SpeechInput value={answer} onChange={onEdit} disabled={busy} />
      <div className="interview-actions">
        <button className="btn btn-secondary" disabled={busy} onClick={onSave}>
          내 질문에 저장
        </button>
        <button className="btn btn-primary" disabled={busy || !answer.trim()} onClick={onEvaluate}>
          내 답변 AI 평가
        </button>
      </div>
    </article>
  );
}
