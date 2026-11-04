import { z } from "zod";
import { answerSchema, progressSchema } from "@/lib/auth/validation";
export const importSchema = z
  .object({ answers: z.array(answerSchema).max(20), progress: z.array(progressSchema).max(20) })
  .strict();
export function buildImportBatches(
  answers: Record<string, string>,
  progress: Record<
    string,
    { status: "NOT_STARTED" | "IN_PROGRESS" | "NEEDS_REVIEW" | "COMPLETED"; bookmarked: boolean }
  >,
) {
  const batches: z.infer<typeof importSchema>[] = [];
  let current: z.infer<typeof importSchema> = { answers: [], progress: [] };
  const flush = () => {
    if (current.answers.length || current.progress.length) batches.push(current);
    current = { answers: [], progress: [] };
  };
  const entries = [
    ...Object.entries(answers).map(([question_key, answer_text]) => ({
      kind: "answers" as const,
      value: { question_key, answer_text },
    })),
    ...Object.entries(progress).map(([question_key, value]) => ({
      kind: "progress" as const,
      value: { question_key, ...value },
    })),
  ];
  for (const entry of entries) {
    const candidate = { answers: [...current.answers], progress: [...current.progress] };
    if (entry.kind === "answers") candidate.answers.push(entry.value);
    else candidate.progress.push(entry.value);
    if (
      candidate.answers.length > 20 ||
      candidate.progress.length > 20 ||
      new TextEncoder().encode(JSON.stringify(candidate)).byteLength > 180000
    )
      flush();
    if (entry.kind === "answers") current.answers.push(entry.value);
    else current.progress.push(entry.value);
  }
  flush();
  return batches;
}
