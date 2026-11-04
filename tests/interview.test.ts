import { describe, expect, it } from "vitest";
import { transition, restoreSession } from "../lib/ai/state";
import { validateFiles, MAX_FILE_BYTES } from "../lib/documents/limits";
import { analysisSchema, evaluationSchema, generationSchema } from "../lib/ai/schemas";
describe("interview boundaries", () => {
  it("rejects impossible transitions and allows the complete lifecycle", () => {
    expect(() => transition("SETUP", "COMPLETED")).toThrow();
    expect(transition("SETUP", "ANALYZING")).toBe("ANALYZING");
    expect(transition("FEEDBACK", "ANSWERING")).toBe("ANSWERING");
  });
  it("rejects excess files, oversize and unsupported documents", () => {
    expect(() => validateFiles(Array(4).fill({ name: "a.txt", size: 1 }))).toThrow();
    expect(() => validateFiles([{ name: "a.txt", size: MAX_FILE_BYTES + 1 }])).toThrow();
    expect(() => validateFiles([{ name: "a.exe", size: 1 }])).toThrow();
    expect(() => validateFiles([{ name: "a.pdf", size: 1 }])).not.toThrow();
  });
  it("rejects partial AI output and fabricated unbounded scores", () => {
    expect(generationSchema.safeParse({ questions: [{ question: "partial" }] }).success).toBe(
      false,
    );
    expect(evaluationSchema.safeParse({ score: 101 }).success).toBe(false);
    expect(analysisSchema.safeParse({ summary: "x" }).success).toBe(false);
  });
  it("discards corrupt session data rather than resuming partial generations", () => {
    expect(restoreSession("{bad")).toBeNull();
    expect(restoreSession(JSON.stringify({ phase: "GENERATING", questions: [] }))).toBeNull();
  });
});
