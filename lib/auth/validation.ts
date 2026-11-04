import { z } from "zod";

export function safeRedirect(value: string | null | undefined, fallback = "/questions"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value))
    return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\x00-\x20]/.test(decoded)) return fallback;
  } catch {
    return fallback;
  }
  return value;
}
export const questionKeySchema = z
  .string()
  .regex(/^(base:[A-Za-z0-9_-]{1,100}|saved:[0-9a-fA-F-]{36})$/);
export const answerSchema = z
  .object({ question_key: questionKeySchema, answer_text: z.string().max(20000) })
  .strict();
export const progressSchema = z
  .object({
    question_key: questionKeySchema,
    status: z.enum(["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVIEW", "COMPLETED"]),
    bookmarked: z.boolean(),
  })
  .strict();
export const progressPatchSchema = z
  .object({
    question_key: questionKeySchema,
    status: progressSchema.shape.status.optional(),
    bookmarked: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.status !== undefined || value.bookmarked !== undefined);
export const savedQuestionSchema = z
  .object({
    id: z.string().min(1).max(150),
    category: z.enum(["CS", "BACKEND", "AI", "PERSONALITY", "MOTIVATION", "BUSINESS", "PROJECTS"]),
    subcategory: z.string().min(1).max(100),
    topic: z.string().min(1).max(200),
    difficulty: z.enum(["BASIC", "INTERMEDIATE", "ADVANCED"]),
    importance: z.enum(["ESSENTIAL", "IMPORTANT", "ADVANCED"]),
    question: z.string().min(1).max(5000),
    modelAnswer: z.object({
      summary: z.string().min(1).max(10000),
      interviewAnswer: z.string().min(1).max(20000),
      detailedExplanation: z.string().min(1).max(20000),
      example: z.string().min(1).max(10000),
      keywords: z.array(z.string().max(100)).max(30),
    }),
    followUps: z
      .array(
        z.object({
          id: z.string().min(1).max(150),
          question: z.string().min(1).max(5000),
          modelAnswer: z.string().min(1).max(10000),
        }),
      )
      .min(2)
      .max(20),
    source: z.object({ type: z.string().max(100), evidence: z.string().max(10000) }).optional(),
  })
  .strict();
export const questionPatchSchema = z
  .object({
    question: savedQuestionSchema.optional(),
    note: z.string().max(10000).optional(),
    company_id: z.uuid().nullable().optional(),
  })
  .strict()
  .refine((v) => v.question !== undefined || v.note !== undefined || v.company_id !== undefined);
