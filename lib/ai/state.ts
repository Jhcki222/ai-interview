import { z } from "zod";
import {
  questionSchema,
  evaluationSchema,
  summarySchema,
  settingsSchema,
  analysisSchema,
  followupSchema,
} from "./schemas";
export const phases = [
  "SETUP",
  "ANALYZING",
  "REVIEW",
  "GENERATING",
  "LEARNING",
  "ANSWERING",
  "EVALUATING",
  "FEEDBACK",
  "SUMMARIZING",
  "COMPLETED",
] as const;
export type Phase = (typeof phases)[number];
const edges: Record<Phase, Phase[]> = {
  SETUP: ["ANALYZING", "REVIEW"],
  ANALYZING: ["REVIEW", "SETUP"],
  REVIEW: ["GENERATING", "SETUP"],
  GENERATING: ["LEARNING", "ANSWERING", "REVIEW"],
  LEARNING: ["SETUP", "ANSWERING"],
  ANSWERING: ["EVALUATING", "SUMMARIZING"],
  EVALUATING: ["FEEDBACK", "ANSWERING"],
  FEEDBACK: ["ANSWERING", "SUMMARIZING"],
  SUMMARIZING: ["COMPLETED", "FEEDBACK"],
  COMPLETED: ["SETUP"],
};
export function transition(from: Phase, to: Phase): Phase {
  if (!edges[from].includes(to)) throw new Error(`Invalid transition: ${from} → ${to}`);
  return to;
}
export const sessionSchema = z
  .object({
    version: z.literal(1),
    id: z.string().max(100).default(""),
    learningAnswers: z.record(z.string(), z.string().max(8000)).default({}),
    learningEvaluations: z.record(z.string(), evaluationSchema).default({}),
    phase: z.enum(["REVIEW", "LEARNING", "ANSWERING", "FEEDBACK", "COMPLETED"]),
    settings: settingsSchema,
    analysis: analysisSchema,
    questions: z.array(questionSchema).max(15),
    index: z.number().int().min(0).max(14),
    turns: z
      .array(z.object({ question: z.string(), answer: z.string(), evaluation: evaluationSchema }))
      .max(45),
    summary: summarySchema.nullable(),
    draft: z.string().max(8000),
    followup: followupSchema.nullable().default(null),
    followupCount: z.number().int().min(0).max(2).default(0),
  })
  .superRefine((value, ctx) => {
    if (
      value.phase !== "REVIEW" &&
      (value.questions.length !== value.settings.count || value.index >= value.questions.length)
    )
      ctx.addIssue({ code: "custom", message: "Incomplete question list" });
    if (value.phase === "COMPLETED" && !value.summary)
      ctx.addIssue({ code: "custom", message: "Missing summary" });
    if (value.phase === "FEEDBACK" && !value.turns.length)
      ctx.addIssue({ code: "custom", message: "Missing evaluation" });
  });
export type Session = z.infer<typeof sessionSchema>;
export function restoreSession(raw: string | null, expectedId?: string): Session | null {
  try {
    const result = sessionSchema.safeParse(JSON.parse(raw || "null"));
    return result.success && (!expectedId || result.data.id === expectedId) ? result.data : null;
  } catch {
    return null;
  }
}
