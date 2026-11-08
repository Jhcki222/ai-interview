import "server-only";
import { z } from "zod";
import { AIError } from "./usage";
import { configuredCatalog, type ProviderCatalog } from "./catalog";

const catalogSchema = z.array(
  z.object({
    provider: z.enum(["groq", "nvidia", "ollama", "openai"]),
    models: z.array(z.string()),
    discovery: z.enum(["allowlist", "live"]),
    warn: z.boolean().optional(),
  }),
);

export async function harnessFetch(path: "/v1/catalog" | "/v1/runs", init: RequestInit = {}) {
  const base = process.env.AI_HARNESS_URL;
  const token = process.env.AI_HARNESS_TOKEN;
  if (!base || !token || token.length < 32)
    throw new AIError("Python 하네스 연결 설정이 필요합니다.", 503);
  let url: URL;
  try {
    url = new URL(path, base);
  } catch {
    throw new AIError("Python 하네스 주소를 확인해 주세요.", 503);
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new AIError("Python 하네스에는 HTTPS 주소가 필요합니다.", 503);

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  try {
    return await fetch(url, { ...init, headers, cache: "no-store", redirect: "error" });
  } catch {
    init.signal?.throwIfAborted();
    throw new AIError("AI 실행 서비스에 연결할 수 없습니다.", 503);
  }
}

export async function getModelCatalog(signal?: AbortSignal): Promise<ProviderCatalog[]> {
  const timeout = AbortSignal.timeout(5500);
  try {
    const response = await harnessFetch("/v1/catalog", {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new Error("Catalog response");
    }
    const entries = catalogSchema.parse(await response.json());
    const configured = Object.fromEntries(
      entries.map(({ provider }) => [`${provider.toUpperCase()}_API_KEY`, "configured"]),
    );
    return configuredCatalog(configured).map((entry) => {
      const live = entries.find(({ provider }) => provider === entry.id)!;
      return {
        ...entry,
        models: entry.models.filter(({ id }) => live.models.includes(id)),
        discovery: live.discovery,
        warning: live.warn
          ? "모델 목록 조회에 실패해 서버 허용 목록을 표시합니다. 연결 상태는 요청 시 확인합니다."
          : undefined,
      };
    });
  } catch {
    signal?.throwIfAborted();
    throw new AIError("Python 하네스에서 모델 목록을 가져오지 못했습니다.", 503);
  }
}
