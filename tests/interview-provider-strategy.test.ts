import { it, expect } from "vitest";
import { z } from "zod";
import { generateForProvider } from "../lib/ai/generation";
it("uses complete structured generation for default Groq without invoking streaming", async () => {
  let streamed = false;
  const result = await generateForProvider({
    schema: z.object({ ok: z.boolean() }),
    complete: async () => ({ ok: true }),
    stream: () => {
      streamed = true;
      throw new Error("unsupported");
    },
    onPartial: () => {
      throw new Error("fake preview");
    },
  });
  expect(result).toEqual({ ok: true });
  expect(streamed).toBe(false);
});
it("consumes OpenAI previews but only returns fully validated output", async () => {
  const partials: unknown[] = [];
  const result = await generateForProvider({
    provider: "openai",
    schema: z.object({ answer: z.string() }),
    complete: async () => {
      throw new Error("wrong strategy");
    },
    stream: () => ({
      partialOutputStream: (async function* () {
        yield { answer: "partial" };
      })(),
      output: Promise.resolve({ answer: "complete" }),
    }),
    onPartial: (p) => partials.push(p),
  });
  expect(partials).toEqual([{ answer: "partial" }]);
  expect(result).toEqual({ answer: "complete" });
});
it("rejects malformed non-streaming results before completion", async () => {
  await expect(
    generateForProvider({
      provider: "groq",
      schema: z.object({ ok: z.boolean() }),
      complete: async () => ({ ok: "invalid" }),
      stream: () => {
        throw new Error("unsupported");
      },
      onPartial: () => {},
    }),
  ).rejects.toThrow();
});
