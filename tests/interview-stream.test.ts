import { describe, it, expect } from "vitest";
import { requestAI } from "../lib/ai/client";
import { z } from "zod";
describe("completed SSE output", () => {
  it("rejects a truncated stream without a completion event", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response('event: progress\ndata: {"message":"working"}\n\n', {
        headers: { "Content-Type": "text/event-stream" },
      });
    try {
      await expect(
        requestAI({}, z.object({ ok: z.boolean() }), new AbortController().signal, () => {}),
      ).rejects.toThrow("완료");
    } finally {
      globalThis.fetch = original;
    }
  });
  it("rejects malformed completed output independently of server validation", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response('event: complete\ndata: {"ok":"wrong"}\n\n');
    try {
      await expect(
        requestAI({}, z.object({ ok: z.boolean() }), new AbortController().signal, () => {}),
      ).rejects.toThrow();
    } finally {
      globalThis.fetch = original;
    }
  });
  it("reassembles split network chunks before validating a completed result", async () => {
    const original = globalThis.fetch;
    const encoder = new TextEncoder();
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (const part of ["event: comp", 'lete\ndata: {"ok":', "true}\n", "\n"])
              controller.enqueue(encoder.encode(part));
            controller.close();
          },
        }),
      );
    try {
      await expect(
        requestAI({}, z.object({ ok: z.boolean() }), new AbortController().signal, () => {}),
      ).resolves.toEqual({ ok: true });
    } finally {
      globalThis.fetch = original;
    }
  });
});
