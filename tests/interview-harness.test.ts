import { describe, it, expect } from "vitest";
import { executeHarness } from "../lib/ai/harness/runtime";
import { validateToolOutput, toolFor } from "../lib/ai/harness/tools";
const selected = { provider: "groq" as const, model: "openai/gpt-oss-20b" };
const input = {
  action: "followup",
  question: "질문",
  answer: "민감한 사용자 답변",
  history: [],
  allowFallback: false,
};
const output = {
  question: "근거는 무엇인가요?",
  reason: "근거 확인",
  modelAnswer: "검증 방법을 설명합니다.",
};
function options() {
  const events: unknown[] = [];
  return {
    events,
    args: {
      input,
      candidates: [selected],
      signal: new AbortController().signal,
      runId: "test-run",
      onStatus: () => {},
      onEvent: (event: unknown) => {
        events.push(event);
      },
    },
  };
}
describe("interview harness", () => {
  it("executes a registered tool and emits ordered redacted terminal records", async () => {
    const { events, args } = options();
    const result = await executeHarness({ ...args, operation: async () => output });
    expect(result.value).toEqual(output);
    expect(JSON.stringify(events)).not.toContain(input.answer);
    expect(JSON.stringify(events)).not.toContain(input.question);
    expect((events.at(-1) as any).stage).toBe("completed");
    expect(events.map((event: any) => event.sequence)).toEqual(events.map((_, i) => i + 1));
  });
  it("rejects invalid input without running the model", async () => {
    let calls = 0;
    const { args } = options();
    await expect(
      executeHarness({
        ...args,
        input: { action: "arbitrary_tool" },
        operation: async () => {
          calls++;
          return output;
        },
      }),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
  it("rejects invalid output without reporting completion or using an unconsented fallback", async () => {
    let calls = 0;
    const { events, args } = options();
    await expect(
      executeHarness({
        ...args,
        candidates: [selected, { provider: "ollama", model: "gemma4:31b" }],
        operation: async () => {
          calls++;
          return { question: "" };
        },
      }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
    expect((events.at(-1) as any).stage).toBe("failed");
    expect(events.some((event: any) => event.stage === "completed")).toBe(false);
  });
  it("never calls the provider after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    const { events, args } = options();
    await expect(
      executeHarness({
        ...args,
        signal: controller.signal,
        operation: async () => {
          calls++;
          return output;
        },
      }),
    ).rejects.toThrow();
    expect(calls).toBe(0);
    expect((events.at(-1) as any).stage).toBe("cancelled");
  });
  it("keeps action resource policies explicit", () => {
    expect(toolFor("generate").maxOutputTokens).toBe(6000);
    expect(toolFor("followup").maxOutputTokens).toBe(1000);
    expect(toolFor("generate").attemptMs("nvidia")).toBe(75000);
  });
  it("rejects duplicate evaluation dimensions at the shared tool boundary", () => {
    const dimension = { name: "정확성", score: 70, evidence: "근거" };
    expect(() =>
      validateToolOutput(
        { action: "evaluate" },
        {
          score: 70,
          dimensions: Array(5).fill(dimension),
          strengths: ["강점"],
          improvements: ["개선"],
          revisedAnswer: "답변",
        },
      ),
    ).toThrow();
  });
  it("uses an explicitly allowed fallback after contract failure and records the transition", async () => {
    const { events, args } = options();
    let calls = 0;
    const result = await executeHarness({
      ...args,
      input: { ...input, allowFallback: true },
      candidates: [selected, { provider: "ollama", model: "gemma4:31b" }],
      operation: async () => (++calls === 1 ? {} : output),
    });
    expect(calls).toBe(2);
    expect(result.selection.provider).toBe("ollama");
    expect(events.some((event: any) => event.stage === "fallback")).toBe(true);
  });
  it("rejects unknown provider models without calling them", async () => {
    const { args } = options();
    let calls = 0;
    await expect(
      executeHarness({
        ...args,
        candidates: [{ provider: "groq", model: "https://untrusted-host/model" }, selected],
        operation: async () => {
          calls++;
          return output;
        },
      }),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
  it("does not accept a result produced after cancellation", async () => {
    const { args, events } = options();
    const controller = new AbortController();
    await expect(
      executeHarness({
        ...args,
        signal: controller.signal,
        operation: async () => {
          controller.abort();
          return output;
        },
      }),
    ).rejects.toThrow();
    expect(events.some((event: any) => event.stage === "completed")).toBe(false);
  });
});
