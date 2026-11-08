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
  return (
    <section className="panel interview-model-picker">
      <h2>AI 모델 선택</h2>
      {loading ? (
        <p role="status">모델 목록 불러오는 중…</p>
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
          <label className="interview-fallback">
            <input
              type="checkbox"
              checked={allowFallback}
              disabled={disabled}
              onChange={(e) => onFallbackChange(e.target.checked)}
            />
            <span>
              <strong>실패 시 다른 제공자로 전환</strong>
              <small className="muted">전환 시 같은 입력을 다른 제공자에 보냅니다.</small>
            </span>
          </label>
        </>
      )}
    </section>
  );
}
