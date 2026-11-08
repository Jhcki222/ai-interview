import { afterEach, expect, it, vi } from "vitest";
import { POST } from "../app/api/ai/route";
import { AIError, consumeUsage } from "../lib/ai/usage";

vi.mock("server-only", () => ({}));
vi.mock("../lib/ai/usage", () => ({
  AIError: class extends Error {
    constructor(
      message: string,
      public status = 503,
      public code?: string,
    ) {
      super(message);
    }
  },
  consumeUsage: vi.fn(),
}));

const url = "http://localhost:3000/api/ai";
const token = "fixture-token-with-at-least-32-characters";
const events =
  'event: complete\ndata: {"question":"왜요?","reason":"근거","modelAnswer":"설명"}\n\n';

function fixture(origin = "http://localhost:3000") {
  vi.stubEnv("AI_HARNESS_URL", "http://127.0.0.1:8000");
  vi.stubEnv("AI_HARNESS_TOKEN", token);
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("AI_PROVIDER", "groq");
  vi.stubEnv("AI_MODEL", "openai/gpt-oss-20b");
  const fetch = vi.fn(async (input: URL, init: RequestInit) => {
    expect(new Headers(init.headers).get("Authorization")).toBe(`Bearer ${token}`);
    if (input.pathname === "/v1/catalog")
      return Response.json([
        { provider: "groq", discovery: "allowlist", models: ["openai/gpt-oss-20b"] },
      ]);
    expect(input.pathname).toBe("/v1/runs");
    expect(consumeUsage).toHaveBeenCalledOnce();
    expect(JSON.parse(String(init.body))).toMatchObject({
      input: { selection: { provider: "groq", model: "openai/gpt-oss-20b" }, allowFallback: false },
    });
    return new Response(events, { headers: { "Content-Type": "text/event-stream" } });
  });
  vi.stubGlobal("fetch", fetch);
  const request = new Request(url, {
    method: "POST",
    headers: { origin, host: "localhost:3000" },
    body: JSON.stringify({
      action: "followup",
      question: "질문",
      answer: "답변",
      allowFallback: false,
    }),
  });
  return { request, fetch };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.mocked(consumeUsage).mockReset();
});

it("admits the request before relaying Python's stream unchanged", async () => {
  const { request, fetch } = fixture();
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(events);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("blocks cross-origin requests and refuses to run after quota rejection", async () => {
  const crossOrigin = fixture("https://untrusted.example");
  expect((await POST(crossOrigin.request)).status).toBe(403);
  expect(crossOrigin.fetch).not.toHaveBeenCalled();

  const allowed = fixture();
  vi.mocked(consumeUsage).mockRejectedValue(new AIError("한도 초과", 429, "RATE_LIMIT"));
  expect((await POST(allowed.request)).status).toBe(429);
  expect(allowed.fetch).toHaveBeenCalledTimes(1);
});
