import { z } from "zod";
export const agentContextSchema = z
  .object({
    questionIndex: z.number().int().min(0).max(14),
    questionCount: z.union([z.literal(5), z.literal(10), z.literal(15)]),
    followupCount: z.number().int().min(0).max(2),
    turnCount: z.number().int().min(1).max(45),
  })
  .strict()
  .refine((value) => value.questionIndex < value.questionCount, "Question index out of bounds");
export const agentDecisionSchema = z.object({
  version: z.literal(1),
  action: z.enum(["followup", "next", "finish"]),
  reason: z.string().min(1).max(500),
  focus: z.string().max(100),
  trace: z
    .array(
      z.object({
        node: z.enum(["evaluate", "validate", "route", "await_confirmation"]),
        detail: z.string().max(500),
      }),
    )
    .length(4),
});
export type AgentDecision = z.infer<typeof agentDecisionSchema>;
export type AgentContext = z.infer<typeof agentContextSchema>;
