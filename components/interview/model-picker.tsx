"use client";
import { useEffect, useRef, useState } from "react";
import type { Selection, ProviderCatalog } from "@/lib/ai/catalog";
export function ModelPicker({
  selection,
  onChange,
  allowFallback,
  onFallbackChange,
  disabled,
}: {
  selection?: Selection;
  onChange: (value: Selection) => void;
  allowFallback: boolean;
  onFallbackChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const latestSelection = useRef(selection);
  latestSelection.current = selection;
  const [providers, setProviders] = useState<ProviderCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/ai/models", { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("모델 목록을 불러오지 못했습니다.");
        const data = await response.json();
        setProviders(data.providers);
        if (
          !data.providers.some(
            (p: ProviderCatalog) =>
              p.id === latestSelection.current?.provider &&
              p.models.some((m) => m.id === latestSelection.current?.model),
          ) &&
          data.selection
        )
          onChange(data.selection);
        if (!data.configured) setError("AI 제공자 설정이 필요합니다. 관리자에게 문의해 주세요.");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, []);
  const current = providers.find((p) => p.id === selection?.provider);
  const currentModel = current?.models.find((model) => model.id === selection?.model);
  return (
    <section className="panel interview-model-picker">
      <div>
        <h2>AI 모델 선택</h2>
        <p className="muted">기본 모델은 Groq GPT-OSS 20B입니다. NVIDIA 등 다른 제공자도 선택할 수 있습니다.</p>
      </div>
      <aside className="interview-token-notice" role="note">
        <strong>AI 이용 한도를 확인해 주세요</strong>
        <p>
          AI 제공자의 토큰·크레딧 잔여량이나 요청 한도에 따라 질문 생성·답변 평가가 제한될 수
          있습니다. 한도에 도달하면 잠시 후 다시 시도하거나 다른 제공자의 모델을 선택해 주세요.
        </p>
        <small>
          잔여량은 제공자 계정에서 확인할 수 있으며, 이 화면은 실시간 잔액을 표시하지 않습니다.
        </small>
      </aside>
      {loading ? (
        <p role="status">모델 목록 초기화 중…</p>
      ) : error ? (
        <p role="alert" className="interview-error">
          {error}
        </p>
      ) : (
        <>
          <div className="interview-form-grid">
            <label>
              AI 제공자
              <select
                className="select"
                value={selection?.provider || ""}
                disabled={disabled}
                onChange={(e) => {
                  const provider = providers.find((p) => p.id === e.target.value);
                  if (provider) onChange({ provider: provider.id, model: provider.models[0].id });
                }}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.models.length}>
                    {p.name}
                    {!p.models.length ? " · 검증된 모델 없음" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              모델
              <select
                className="select"
                value={selection?.model || ""}
                disabled={disabled}
                onChange={(e) => {
                  if (selection) onChange({ ...selection, model: e.target.value });
                }}
              >
                {current?.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            선택 모델 상태: 한국어 JSON 연결 검증 통과 (2026-11-04). 실제 면접 응답은 매 요청마다
            다시 검증합니다.
          </p>
          {currentModel?.costNote && (
            <p className="muted">
              {currentModel.costNote}{" "}
              {current?.id !== "nvidia" && (
                <a
                  href={
                    current?.id === "groq"
                      ? "https://console.groq.com/docs/models"
                      : "https://ollama.com/pricing"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  공식 요금표 ↗
                </a>
              )}
            </p>
          )}
          {current?.unavailableModels?.length ? (
            <p className="muted">
              연결 실패·미검증으로 선택 제외:{" "}
              {current.unavailableModels.map((m) => `${m.id} (${m.code})`).join(", ")}
            </p>
          ) : null}
          {current?.warning && <p className="muted">{current.warning}</p>}
          <label className="interview-fallback">
            <input
              type="checkbox"
              checked={allowFallback}
              disabled={disabled}
              onChange={(e) => onFallbackChange(e.target.checked)}
            />
            <span>
              <strong>연결 실패 시 다른 설정된 AI 제공자로 자동 대체 허용</strong>
              <small className="muted">
                허용하면 같은 입력이 대체 제공자에도 전송됩니다. 사용 모델과 재시도 상태를
                표시합니다.
              </small>
            </span>
          </label>
          <p className="muted">
            모델 목록은 지원 후보 목록이며 실시간 응답 성공을 보장하지 않습니다.
            NVIDIA·Ollama·Groq는 완료 후 전체 응답을 검증합니다.
          </p>
        </>
      )}
    </section>
  );
}
