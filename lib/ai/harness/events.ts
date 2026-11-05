import { z } from "zod";
export const harnessEventSchema = z
  .object({
    version: z.literal("interview-harness-v1"),
    runId: z.string().min(1).max(100),
    sequence: z.number().int().positive(),
    action: z.enum(["analyze", "generate", "evaluate", "followup", "summary"]),
    stage: z.enum([
      "accepted",
      "connecting",
      "processing",
      "retrying",
      "fallback",
      "validating",
      "completed",
      "failed",
      "cancelled",
    ]),
    elapsedMs: z.number().nonnegative(),
    provider: z.enum(["groq", "nvidia", "ollama", "openai"]).optional(),
    model: z.string().max(200).optional(),
    code: z.string().max(100).optional(),
  })
  .strict();
export type HarnessEvent = z.infer<typeof harnessEventSchema>;
