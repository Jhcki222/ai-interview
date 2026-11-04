"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "./auth-provider";
import { companyDialogRequestMatches, type CompanyDialogRequest } from "@/lib/auth/session";
import type { Question } from "@/types/question";
import type { CompanyCollection } from "@/types/company";
import "./company-board.css";

export function QuestionCompanyDialog({
  question,
  onClose,
  onSaved,
  suggestedCompanyName = "",
}: {
  question: Question | null;
  onClose: () => void;
  onSaved?: (message: string) => void;
  suggestedCompanyName?: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const owner = user?.id ?? null;
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const [data, setData] = useState<{ owner: string; companies: CompanyCollection[] } | null>(null);
  const [selected, setSelected] = useState("");
  const [pendingRequest, setPending] = useState<CompanyDialogRequest | null>(null);
  const requestVersion = useRef(0);
  const currentQuestion = useRef(question?.id ?? null);
  currentQuestion.current = question?.id ?? null;
  const saveController = useRef<AbortController | null>(null);
  const pending = companyDialogRequestMatches(pendingRequest, {
    owner,
    questionId: question?.id ?? null,
    version: requestVersion.current,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const version = ++requestVersion.current;
    saveController.current?.abort();
    saveController.current = null;
    setPending(null);
    setData(null);
    setSelected("");
    setError("");
    setLoading(false);
    if (!question || !owner || authLoading) return;
    const requestOwner = owner;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    setSelected("");
    fetch("/api/me/companies", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!active || currentOwner.current !== requestOwner || requestVersion.current !== version)
          return;
        if (!response.ok) throw new Error(result.error);
        setData({ owner: requestOwner, companies: result.companies });
        const suggested = result.companies.find(
          (company: CompanyCollection) =>
            company.name.trim().toLocaleLowerCase("ko") ===
            suggestedCompanyName.trim().toLocaleLowerCase("ko"),
        );
        setSelected(suggested?.id ?? "");
      })
      .catch((e) => {
        if (active && currentOwner.current === requestOwner && requestVersion.current === version)
          setError(e instanceof Error ? e.message : "기업을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active && currentOwner.current === requestOwner && requestVersion.current === version)
          setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
      saveController.current?.abort();
    };
  }, [question, owner, authLoading, suggestedCompanyName]);
  async function save() {
    if (!question || !owner || data?.owner !== owner) return;
    const requestOwner = owner;
    const request = {
      owner: requestOwner,
      questionId: question.id,
      version: requestVersion.current,
    };
    const isCurrent = () =>
      companyDialogRequestMatches(request, {
        owner: currentOwner.current,
        questionId: currentQuestion.current,
        version: requestVersion.current,
      });
    const controller = new AbortController();
    saveController.current = controller;
    setPending(request);
    setError("");
    try {
      const response = await fetch("/api/me/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, company_id: selected || null }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) throw new Error(result.error);
      onSaved?.(
        result.alreadySaved
          ? "이미 저장한 질문입니다. 기존 기업 폴더와 답안은 유지됩니다."
          : "내가 만든 질문에 저장했습니다.",
      );
      onClose();
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : "질문을 저장하지 못했습니다.");
    } finally {
      if (isCurrent()) {
        setPending(null);
        saveController.current = null;
      }
    }
  }
  return (
    <Dialog
      open={!!question}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="company-dialog">
        <DialogHeader>
          <DialogTitle>
            <FolderOpen size={19} />
            기업 폴더에 질문 저장
          </DialogTitle>
          <DialogDescription>
            지원하는 기업을 선택하면 내가 만든 질문에서 함께 준비할 수 있어요.
          </DialogDescription>
        </DialogHeader>
        {!owner ? (
          <div className="company-save-dialog-body">
            <p>질문을 저장하려면 로그인이 필요합니다.</p>
            <Link className="btn btn-primary" href="/login?next=/interview">
              로그인하기
            </Link>
          </div>
        ) : (
          <>
            <div className="company-save-dialog-body">
              <p className="company-save-question">{question?.question}</p>
              {loading ? (
                <p role="status">기업 폴더를 불러오는 중…</p>
              ) : (
                <label className="company-picker-label">
                  저장할 기업
                  <select
                    className="select"
                    value={selected}
                    onChange={(event) => setSelected(event.target.value)}
                    disabled={pending || data?.owner !== owner}
                  >
                    <option value="">미분류</option>
                    {(data?.owner === owner ? data.companies : []).map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                        {company.position ? ` · ${company.position}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p
                className="muted"
                style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}
              >
                <Building2 size={14} />새 기업은{" "}
                <Link href="/my/questions" target="_blank" rel="noopener noreferrer">
                  내가 만든 질문
                </Link>
                에서 추가할 수 있어요.
              </p>
              {error && (
                <p role="alert" className="company-error">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <button className="btn btn-secondary" disabled={pending} onClick={onClose}>
                취소
              </button>
              <button
                className="btn btn-primary"
                disabled={pending || loading || !!error || data?.owner !== owner}
                onClick={() => void save()}
              >
                {pending ? "저장 중…" : "질문 저장"}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
