import { it, expect } from "vitest";
import { chooseSelection, configuredCatalog } from "../lib/ai/catalog";
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
