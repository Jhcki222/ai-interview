"use client";
import { memo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  BookmarkAdd02Icon,
  BookmarkCheck02Icon,
  BulbIcon,
  Edit02Icon,
  FolderAddIcon,
  Link01Icon,
  MessageMultiple02Icon,
  FloppyDiskIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { LearningStatus, Progress, Question } from "@/types/question";
import { difficultyLabels, importanceLabels } from "@/lib/questions";
import { Button } from "@/components/ui/button";
import { SpeechInput } from "@/components/ui/speech-input";
import { cn } from "@/lib/utils";
export const statusLabels: Record<LearningStatus, string> = {
  NOT_STARTED: "학습 전",
  IN_PROGRESS: "학습 중",
  NEEDS_REVIEW: "복습 필요",
  COMPLETED: "학습 완료",
};
interface Props {
  question: Question;
  index?: number;
  answer: string;
  progress?: Progress;
  busy: boolean;
  detail?: boolean;
  titleHref?: string | null;
  domId?: string;
  onEdit: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onProgress: (patch: Partial<Progress>) => void;
  onBookmark: () => void;
  onSaveQuestion: () => void;
}
export const QuestionCard = memo(function QuestionCard({
  question: q,
  index,
  answer,
  progress,
  busy,
  detail = false,
  titleHref,
  domId,
  onEdit,
  onSave,
  onDelete,
  onProgress,
  onBookmark,
  onSaveQuestion,
}: Props) {
  const [modelOpen, setModelOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(detail);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const elementId = domId ?? q.id;
  return (
    <article className={cn("question-card", detail && "question-card-detail")} id={elementId}>
      <div className="question-card-heading">
        <span className="question-index">
          {detail ? "Q" : String((index ?? 0) + 1).padStart(2, "0")}
        </span>
        <div className="question-heading-content">
          <div className="question-meta">
            <span>{q.subcategory}</span>
            <span className={`difficulty difficulty-${q.difficulty.toLowerCase()}`}>
              {difficultyLabels[q.difficulty]}
            </span>
            <span className={`importance importance-${q.importance.toLowerCase()}`}>
              {importanceLabels[q.importance]}
            </span>
            {progress && progress.status !== "NOT_STARTED" && (
              <span className="question-status">{statusLabels[progress.status]}</span>
            )}
          </div>
          <h2>
            {detail || titleHref === null ? (
              q.question
            ) : (
              <Link href={titleHref ?? `/questions/${q.id}`}>{q.question}</Link>
            )}
          </h2>
          <div className="question-keywords">
            {q.modelAnswer.keywords.slice(0, 4).map((keyword) => (
              <span key={keyword}>#{keyword}</span>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn("bookmark-button", progress?.bookmarked && "is-bookmarked")}
          aria-label={progress?.bookmarked ? "북마크 해제" : "북마크 추가"}
          aria-pressed={progress?.bookmarked ?? false}
          disabled={busy}
          onClick={onBookmark}
        >
          {progress?.bookmarked ? (
            <HugeiconsIcon icon={BookmarkCheck02Icon} size={18} />
          ) : (
            <HugeiconsIcon icon={BookmarkAdd02Icon} size={18} />
          )}
        </Button>
      </div>
      <div className="question-actions">
        <button
          className={cn("question-action", modelOpen && "is-expanded")}
          aria-expanded={modelOpen}
          aria-controls={`${elementId}-model`}
          onClick={() => setModelOpen(!modelOpen)}
        >
          <HugeiconsIcon icon={BulbIcon} size={14} /> 모범답안 <ChevronDown size={12} />
        </button>
        <button
          className={cn("question-action", followOpen && "is-expanded")}
          aria-expanded={followOpen}
          aria-controls={`${elementId}-follow`}
          onClick={() => setFollowOpen(!followOpen)}
        >
          <HugeiconsIcon icon={MessageMultiple02Icon} size={14} /> 꼬리질문{" "}
          <span className="follow-count">{q.followUps.length}</span>
          <ChevronDown size={12} />
        </button>
        <button
          className={cn("question-action", editorOpen && "is-expanded")}
          aria-expanded={editorOpen}
          aria-controls={`${elementId}-editor`}
          onClick={() => setEditorOpen(!editorOpen)}
        >
          <HugeiconsIcon icon={Edit02Icon} size={14} /> 내 답변{" "}
          {answer && <span className="draft-dot" />}
        </button>
        <div className="question-actions-right">
          <label className="sr-only" htmlFor={`${elementId}-status`}>
            학습 상태
          </label>
          <select
            id={`${elementId}-status`}
            value={progress?.status ?? "NOT_STARTED"}
            disabled={busy}
            onChange={(event) => onProgress({ status: event.target.value as LearningStatus })}
            className="status-select"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {modelOpen && (
          <motion.div
            className="model-answer-section"
            id={`${elementId}-model`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="answer-summary">
              <span>
                <HugeiconsIcon icon={BulbIcon} size={16} />
              </span>
              <div>
                <h3>핵심 요약</h3>
                <p>{q.modelAnswer.summary}</p>
              </div>
            </div>
            <section className="answer-block">
              <h3>
                <span className="answer-label-dot" />
                30–60초 면접 답변
              </h3>
              <p>{q.modelAnswer.interviewAnswer}</p>
            </section>
            <section className="answer-block">
              <h3>조금 더 깊이 이해하기</h3>
              <p>{q.modelAnswer.detailedExplanation}</p>
            </section>
            <section className="answer-block answer-example">
              <h3>실무에서는 이렇게</h3>
              <p>{q.modelAnswer.example}</p>
            </section>
            <div className="answer-end">
              <span>{q.modelAnswer.keywords.map((k) => `#${k}`).join("  ")}</span>
              <Button variant="ghost" size="sm" onClick={onSaveQuestion} disabled={busy}>
                <HugeiconsIcon icon={FolderAddIcon} size={14} />내 질문에 저장
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {followOpen && (
          <motion.div
            className="follow-up-section"
            id={`${elementId}-follow`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <p className="follow-up-heading">
              <HugeiconsIcon icon={Link01Icon} size={14} />한 단계 더 생각해 볼까요?
            </p>
            {q.followUps.map((follow, i) => (
              <details key={follow.id} className="follow-up">
                <summary>
                  <span>{i + 1}</span>
                  {follow.question}
                  <ChevronDown size={14} />
                </summary>
                <p>{follow.modelAnswer}</p>
              </details>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {editorOpen && (
          <motion.div
            className="answer-editor"
            id={`${elementId}-editor`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="editor-heading">
              <label htmlFor={`${elementId}-answer`}>나의 언어로 정리하는 답변</label>
              <span>최대 20,000자</span>
            </div>
            <textarea
              id={`${elementId}-answer`}
              className="textarea"
              placeholder="핵심 개념부터 나만의 예시까지, 면접에서 설명하듯 작성해 보세요."
              rows={6}
              maxLength={20000}
              value={answer}
              onChange={(event) => onEdit(event.target.value)}
            />
            <SpeechInput value={answer} onChange={onEdit} disabled={busy} />
            <div className="editor-footer">
              <span>{answer.length.toLocaleString()} / 20,000</span>
              <div>
                {answer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setDeleteOpen(!deleteOpen)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={14} />
                    삭제
                  </Button>
                )}
                <Button size="sm" onClick={onSave} disabled={busy || !answer.trim()}>
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={FloppyDiskIcon} size={14} />
                  )}
                  답변 저장
                </Button>
              </div>
            </div>
            {deleteOpen && (
              <div className="delete-confirm" role="alert">
                <span>작성한 답변을 삭제할까요?</span>
                <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
                  취소
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onDelete();
                    setDeleteOpen(false);
                  }}
                >
                  삭제하기
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
});
