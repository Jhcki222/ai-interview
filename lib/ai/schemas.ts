import { z } from "zod";
import { savedQuestionSchema } from "../auth/validation";
const text = z.string().trim().min(1).max(8000);
// Member validation is client-safe and owns the persistence bounds for every question field.
export const questionSchema = savedQuestionSchema.extend({
  id: savedQuestionSchema.shape.id.max(100),
  modelAnswer: savedQuestionSchema.shape.modelAnswer.extend({
    keywords: z.array(z.string().trim().min(1).max(100)).min(1).max(15),
  }),
  followUps: savedQuestionSchema.shape.followUps.max(4),
  source: savedQuestionSchema.shape.source.unwrap(),
});
export const analysisSchema = z.object({
  summary: text,
  skills: z.array(text).max(30),
  experiences: z.array(z.object({ description: text, evidence: text })).max(20),
  uncertainties: z.array(text).max(20),
});
export const generationSchema = z.object({ questions: z.array(questionSchema).min(5).max(15) });
export const evaluationSchema = z.object({
  score: z.number().min(0).max(100),
  dimensions: z
    .array(
      z.object({
        name: z.enum(["정확성", "논리성", "구체성", "질문 적합성", "실무 적용성"]),
        score: z.number().min(0).max(100),
        evidence: text,
      }),
    )
    .length(5),
  strengths: z.array(text).min(1).max(5),
  improvements: z.array(text).min(1).max(5),
  revisedAnswer: text,
});
export const followupSchema = z.object({ question: text, reason: text, modelAnswer: text });
export const summarySchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: text,
  strengths: z.array(text).min(1).max(10),
  priorities: z.array(text).min(1).max(10),
  studyPlan: z.array(text).min(1).max(10),
});
export const MAX_JOB_POSTING_CHARS = 12000;
export const settingsSchema = z.object({
  role: z.string().min(1).max(100),
  level: z.enum(["신입", "주니어", "시니어"]),
  count: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  mode: z.enum(["learn", "chat"]),
  company: z.string().trim().max(100).default(""),
  industry: z.string().trim().max(100).default(""),
  division: z.string().trim().max(100).default(""),
  jobPosting: z.string().trim().max(MAX_JOB_POSTING_CHARS).default(""),
  interviewType: z
    .enum(["technical", "project", "personality", "motivation", "comprehensive"])
    .default("comprehensive"),
  difficulty: z.enum(["BASIC", "INTERMEDIATE", "ADVANCED"]).default("INTERMEDIATE"),
});
export const summaryEvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  dimensions: z
    .array(
      z.object({
        name: z.enum(["정확성", "논리성", "구체성", "질문 적합성", "실무 적용성"]),
        score: z.number().min(0).max(100),
        evidence: z.string().min(1).max(80),
      }),
    )
    .length(5),
  strengths: z.array(z.string().min(1).max(80)).length(1),
  improvements: z.array(z.string().min(1).max(80)).length(1),
});
export const conversationHistorySchema = z
  .array(z.object({ question: z.string().min(1).max(400), answer: z.string().min(1).max(500) }))
  .max(3);
const coreRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("analyze"),
    documents: z.string().min(1).max(45000),
    settings: settingsSchema,
  }),
  z.object({ action: z.literal("generate"), analysis: analysisSchema, settings: settingsSchema }),
  z.object({
    action: z.literal("evaluate"),
    question: z.string().min(1).max(8000),
    answer: z.string().min(1).max(8000),
    history: conversationHistorySchema.default([]),
  }),
  z.object({
    action: z.literal("followup"),
    question: z.string().min(1).max(8000),
    answer: z.string().min(1).max(8000),
    history: conversationHistorySchema.default([]),
  }),
  z.object({
    action: z.literal("summary"),
    excerpted: z.literal(true),
    turns: z
      .array(
        z.object({
          question: z.string().min(1).max(120),
          answer: z.string().min(1).max(360),
          evaluation: summaryEvaluationSchema,
        }),
      )
      .min(1)
      .max(45),
  }),
]);
export type Analysis = z.infer<typeof analysisSchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Summary = z.infer<typeof summarySchema>;

export const modelSelectionSchema = z
  .object({
    provider: z.enum(["nvidia", "groq", "ollama", "openai"]),
    model: z.string().min(1).max(200),
  })
  .strict();
export const requestSchema = coreRequestSchema.and(
  z.object({
    selection: modelSelectionSchema.optional(),
    allowFallback: z.boolean().default(true),
  }),
);
