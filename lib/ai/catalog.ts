export type ProviderId = "nvidia" | "groq" | "ollama" | "openai";
export type Selection = { provider: ProviderId; model: string };
export type ProviderCatalog = {
  id: ProviderId;
  name: string;
  models: { id: string; name: string; costNote?: string }[];
  discovery: "live" | "allowlist";
  warning?: string;
  unavailableModels?: { id: string; code: string }[];
};
export const ALLOWED_MODELS: Record<ProviderId, string[]> = {
  nvidia: [
    "nvidia/nemotron-3-ultra-550b-a55b",
    "google/gemma-4-31b-it",
    "openai/gpt-oss-20b",
    "nvidia/nemotron-3-super-120b-a12b",
  ],
  groq: ["openai/gpt-oss-20b", "openai/gpt-oss-120b"],
  ollama: ["gemma4:31b", "gpt-oss:20b", "gpt-oss:120b"],
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-5-mini"],
};
// Real synthetic Korean JSON probes on 2026-11-04. Discovery alone is not a health check.
export const VERIFIED_MODELS: Record<ProviderId, string[]> = {
  nvidia: ["nvidia/nemotron-3-ultra-550b-a55b"],
  groq: ["openai/gpt-oss-20b", "openai/gpt-oss-120b"],
  ollama: ["gemma4:31b", "gpt-oss:20b", "gpt-oss:120b"],
  openai: [],
};
export function modelDisplayName(id: string) {
  const labels: Record<string, string> = {
    "nvidia/nemotron-3-ultra-550b-a55b": "NVIDIA Nemotron 3 Ultra · 한국어 지원",
    "openai/gpt-oss-20b": "GPT-OSS 20B",
    "openai/gpt-oss-120b": "GPT-OSS 120B",
    "gemma4:31b": "Gemma 4 31B · 다국어",
    "gpt-oss:20b": "GPT-OSS 20B",
    "gpt-oss:120b": "GPT-OSS 120B",
  };
  return labels[id] || id;
}
export function modelCostNote(provider: ProviderId, model: string) {
  if (provider === "nvidia")
    return "요금은 NVIDIA 계정·엔드포인트 약관을 확인하세요. 공개 확정 토큰 단가는 표시하지 않습니다.";
  const costs: Record<string, string> = {
    "groq:openai/gpt-oss-20b": "입력 $0.075 / 출력 $0.30",
    "groq:openai/gpt-oss-120b": "입력 $0.15 / 출력 $0.60",
    "ollama:gemma4:31b": "입력 $0.14 / 출력 $0.40",
    "ollama:gpt-oss:20b": "입력 $0.07 / 출력 $0.30",
    "ollama:gpt-oss:120b": "입력 $0.15 / 출력 $0.60",
  };
  const cost = costs[`${provider}:${model}`];
  return cost ? `${cost} / 100만 토큰 · USD · 2026-11-04 공식 요금 기준` : undefined;
}
const keys: Record<ProviderId, string> = {
  nvidia: "NVIDIA_API_KEY",
  groq: "GROQ_API_KEY",
  ollama: "OLLAMA_API_KEY",
  openai: "OPENAI_API_KEY",
};
const names: Record<ProviderId, string> = {
  nvidia: "NVIDIA",
  groq: "Groq",
  ollama: "Ollama Cloud",
  openai: "OpenAI",
};
export function configuredCatalog(env: Record<string, string | undefined>): ProviderCatalog[] {
  return (Object.keys(keys) as ProviderId[])
    .filter((id) => !!env[keys[id]])
    .map((id) => ({
      id,
      name: names[id],
      models: VERIFIED_MODELS[id].map((model) => ({
        id: model,
        name: modelDisplayName(model),
        costNote: modelCostNote(id, model),
      })),
      unavailableModels: ALLOWED_MODELS[id]
        .filter((model) => !VERIFIED_MODELS[id].includes(model))
        .map((model) => ({
          id: model,
          code: model.includes("nemotron-3-super") ? "MODEL_UNAVAILABLE" : "UNVERIFIED_OR_TIMEOUT",
        })),
      discovery: "allowlist",
    }));
}
export function chooseSelection(
  catalog: ProviderCatalog[],
  requested: Partial<Selection>,
  env: Record<string, string | undefined> = {},
): Selection {
  const provider = requested.provider || (env.AI_PROVIDER as ProviderId) || "nvidia";
  const entry =
    catalog.find((c) => c.id === provider) || (!requested.provider ? catalog[0] : undefined);
  if (!entry || !entry.models.length) throw new Error("MISSING_CONFIG");
  const desired = requested.model || env.AI_MODEL;
  const model =
    entry.models.find((m) => m.id === desired)?.id ||
    (!requested.model ? entry.models[0].id : undefined);
  if (!model) throw new Error("INVALID_MODEL");
  return { provider: entry.id, model };
}
export function fallbackSelections(catalog: ProviderCatalog[], selected: Selection): Selection[] {
  return [
    selected,
    ...catalog
      .filter((c) => c.id !== selected.provider && c.models.length)
      .map((c) => ({ provider: c.id, model: c.models[0].id })),
  ];
}
