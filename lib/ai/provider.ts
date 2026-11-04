import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { AIError } from "./usage";
import { nvidiaStructuredBody } from "./provider-transport";
import {
  configuredCatalog,
  chooseSelection,
  type Selection,
  type ProviderCatalog,
  ALLOWED_MODELS,
  VERIFIED_MODELS,
} from "./catalog";
let cache: { expires: number; catalog: ProviderCatalog[] } | null = null;
export async function getModelCatalog(): Promise<ProviderCatalog[]> {
  if (cache && cache.expires > Date.now()) return cache.catalog;
  const catalog = configuredCatalog(process.env);
  await Promise.all(
    catalog
      .filter((p) => p.id === "nvidia" || p.id === "ollama")
      .map(async (entry) => {
        try {
          const nvidia = entry.id === "nvidia";
          const response = await fetch(
            nvidia ? "https://integrate.api.nvidia.com/v1/models" : "https://ollama.com/api/tags",
            {
              headers: {
                Authorization: `Bearer ${nvidia ? process.env.NVIDIA_API_KEY : process.env.OLLAMA_API_KEY}`,
              },
              signal: AbortSignal.timeout(4000),
              cache: "no-store",
            },
          );
          if (!response.ok) throw new Error("catalog");
          const data = await response.json();
          const ids: string[] = nvidia
            ? (data.data || []).map((m: { id: string }) => m.id)
            : (data.models || []).map((m: { name: string }) => m.name.replace(/-cloud$/, ""));
          const filtered = VERIFIED_MODELS[entry.id].filter((id) => ids.includes(id));
          if (filtered.length) {
            entry.models = entry.models.filter((model) => filtered.includes(model.id));
            entry.discovery = "live";
          } else
            entry.warning =
              "제공자 목록에서 허용된 모델을 확인하지 못했습니다. 연결 시 실제 지원 여부를 확인합니다.";
        } catch {
          entry.warning =
            "모델 목록 조회에 실패해 서버 허용 목록을 표시합니다. 연결 상태는 요청 시 확인합니다.";
        }
      }),
  );
  cache = { expires: Date.now() + 60000, catalog };
  return catalog;
}
export function getAIModel(selection?: Selection) {
  const selected = selection || chooseSelection(configuredCatalog(process.env), {}, process.env);
  const model = selected.model;
  if (!ALLOWED_MODELS[selected.provider]?.includes(model))
    throw new AIError("허용되지 않은 모델입니다.", 400);
  const keys = {
    nvidia: process.env.NVIDIA_API_KEY,
    groq: process.env.GROQ_API_KEY,
    ollama: process.env.OLLAMA_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };
  const key = keys[selected.provider];
  if (!key) throw new AIError("선택한 AI 제공자 연결 설정이 필요합니다.");
  if (selected.provider === "groq") return createGroq({ apiKey: key })(model);
  if (selected.provider === "nvidia")
    return createOpenAI({
      apiKey: key,
      baseURL: "https://integrate.api.nvidia.com/v1",
      name: "nvidia",
      fetch: (url, init) =>
        fetch(url, {
          ...init,
          body: typeof init?.body === "string" ? nvidiaStructuredBody(init.body) : init?.body,
        }),
    }).chat(model);
  if (selected.provider === "ollama")
    return createOpenAI({ apiKey: key, baseURL: "https://ollama.com/v1", name: "ollama" }).chat(
      model,
    );
  return createOpenAI({ apiKey: key })(model);
}
