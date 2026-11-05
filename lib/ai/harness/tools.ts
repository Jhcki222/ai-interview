import {
  analysisSchema,
  generationSchema,
  evaluationSchema,
  followupSchema,
  summarySchema,
  type requestSchema,
} from "../schemas";
import type { ProviderId } from "../catalog";
import type { z } from "zod";
export type HarnessInput = z.infer<typeof requestSchema>;
export type ToolAction = HarnessInput["action"];
export const HARNESS_VERSION = "interview-harness-v1";
export const HARNESS_BUDGET_MS = 105000;
export const MAX_PROVIDER_CANDIDATES = 3;
const definitions = {
  analyze: { label: "문서 분석", schema: analysisSchema, maxOutputTokens: 2800 },
  generate: { label: "면접 질문 생성", schema: generationSchema, maxOutputTokens: 6000 },
  evaluate: { label: "답변 평가", schema: evaluationSchema, maxOutputTokens: 2200 },
  followup: { label: "꼬리질문 생성", schema: followupSchema, maxOutputTokens: 1000 },
  summary: { label: "종합 평가", schema: summarySchema, maxOutputTokens: 2200 },
} as const;
export function toolFor(action: ToolAction) {
  const definition = definitions[action];
  if (!definition) throw new Error("Unknown harness tool");
  return {
    ...definition,
    attemptMs: (provider: ProviderId) =>
      action === "generate" && provider === "nvidia" ? 75000 : 30000,
  };
}
export function validateToolOutput(
  input: Pick<HarnessInput, "action"> & { settings?: { count: number } },
  raw: unknown,
): unknown {
  const output = toolFor(input.action).schema.parse(raw);
  if (input.action === "generate") {
    const questions = generationSchema.parse(output).questions;
    if (
      questions.length !== input.settings?.count ||
      new Set(questions.map((item) => item.id)).size !== questions.length
    )
      throw Object.assign(new Error("Invalid question count or identity"), {
        name: "AI_TypeValidationError",
      });
  }
  if (
    input.action === "evaluate" &&
    new Set(evaluationSchema.parse(output).dimensions.map((item) => item.name)).size !== 5
  )
    throw Object.assign(new Error("Duplicate evaluation dimensions"), {
      name: "AI_TypeValidationError",
    });
  return output;
}
