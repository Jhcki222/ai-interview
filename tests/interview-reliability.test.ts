import { describe, it, expect } from "vitest";
import { chooseSelection, configuredCatalog } from "../lib/ai/catalog";
import { classifyProviderError, runReliable } from "../lib/ai/reliability";
describe("provider selection and reliability", () => {
  it("defaults to NVIDIA and rejects models outside the server allowlist", () => {
    const catalog = configuredCatalog({ NVIDIA_API_KEY: "set", GROQ_API_KEY: "set" });
    expect(chooseSelection(catalog, {}).provider).toBe("groq");
    expect(() =>
      chooseSelection(catalog, { provider: "nvidia", model: "https://evil/model" }),
    ).toThrow();
    expect(configuredCatalog({})).toEqual([]);
  });
  it("classifies errors without leaking provider messages", () => {
    const value = classifyProviderError({ statusCode: 401, message: "secret-content" });
    expect(value.code).toBe("AUTH_ERROR");
    expect(value.retryable).toBe(false);
    expect(JSON.stringify(value)).not.toContain("secret-content");
    expect(
      classifyProviderError({ statusCode: 429, responseHeaders: { "retry-after": "2" } }),
    ).toMatchObject({ code: "RATE_LIMIT", retryAfterMs: 2000 });
  });
  it("does not retry authentication failures and uses only opted-in fallback", async () => {
    const calls: string[] = [];
    const candidates = [
      { provider: "nvidia" as const, model: "first" },
      { provider: "groq" as const, model: "second" },
    ];
    const result = await runReliable({
      candidates,
      allowFallback: true,
      signal: new AbortController().signal,
      operation: async (candidate) => {
        calls.push(candidate.model);
        if (candidate.model === "first") throw { statusCode: 401 };
        return "ok";
      },
      onStatus: () => {},
    });
    expect(calls).toEqual(["first", "second"]);
    expect(result.value).toBe("ok");
  });
  it("retries rate limits once with the supplied bounded delay", async () => {
    let attempts = 0;
    const delays: number[] = [];
    await runReliable({
      candidates: [{ provider: "groq", model: "m" }],
      allowFallback: false,
      signal: new AbortController().signal,
      operation: async () => {
        if (++attempts === 1) throw { statusCode: 429, responseHeaders: { "retry-after": "1" } };
        return "ok";
      },
      onStatus: () => {},
      sleep: async (ms) => {
        delays.push(ms);
      },
    });
    expect(attempts).toBe(2);
    expect(delays).toEqual([1000]);
  });
  it("aborted calls never start retry or fallback", async () => {
    let calls = 0;
    const control = new AbortController();
    control.abort();
    await expect(
      runReliable({
        candidates: [
          { provider: "nvidia", model: "m" },
          { provider: "groq", model: "g" },
        ],
        allowFallback: true,
        signal: control.signal,
        operation: async () => {
          calls++;
          return "bad";
        },
        onStatus: () => {},
      }),
    ).rejects.toBeDefined();
    expect(calls).toBe(0);
  });
});

it("never calls fallback when the user has disabled it", async () => {
  const calls: string[] = [];
  await expect(
    runReliable({
      candidates: [
        { provider: "nvidia", model: "a" },
        { provider: "groq", model: "b" },
      ],
      allowFallback: false,
      signal: new AbortController().signal,
      operation: async (selection) => {
        calls.push(selection.model);
        throw { statusCode: 401 };
      },
      onStatus: () => {},
    }),
  ).rejects.toMatchObject({ detail: { code: "AUTH_ERROR" } });
  expect(calls).toEqual(["a"]);
});
it("does not enable unverified or failed models just because inventory lists them", () => {
  const catalog = configuredCatalog({ NVIDIA_API_KEY: "set", OLLAMA_API_KEY: "set" });
  expect(catalog.find((p) => p.id === "nvidia")?.models.map((m) => m.id)).toEqual([
    "nvidia/nemotron-3-ultra-550b-a55b",
  ]);
  expect(() =>
    chooseSelection(catalog, { provider: "nvidia", model: "nvidia/nemotron-3-super-120b-a12b" }),
  ).toThrow();
  expect(
    chooseSelection(catalog, {}, { AI_PROVIDER: "nvidia", AI_MODEL: "retired-qwen" }).model,
  ).toBe("nvidia/nemotron-3-ultra-550b-a55b");
});
