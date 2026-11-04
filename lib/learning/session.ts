import type { Progress } from "@/types/question";
export const GUEST_LEARNING_KEY = "interview.learning.v1";
export interface LearningData {
  answers: Record<string, string>;
  progress: Record<string, Progress>;
}
const validKey = (key: string) => /^base:[A-Za-z0-9_-]{1,100}$/.test(key);
const statuses = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVIEW", "COMPLETED"];
export function restoreGuestLearning(raw: string | null): LearningData {
  const result: LearningData = { answers: {}, progress: {} };
  if (!raw || raw.length > 4_000_000) return result;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return result;
    for (const [key, text] of Object.entries(value.answers ?? {})) {
      if (validKey(key) && typeof text === "string" && text.length <= 20_000)
        result.answers[key] = text;
    }
    for (const [key, state] of Object.entries(value.progress ?? {})) {
      if (
        validKey(key) &&
        state &&
        typeof state === "object" &&
        "status" in state &&
        "bookmarked" in state &&
        typeof state.status === "string" &&
        statuses.includes(state.status) &&
        typeof state.bookmarked === "boolean"
      )
        result.progress[key] = {
          status: state.status as Progress["status"],
          bookmarked: state.bookmarked,
        };
    }
  } catch {
    /* Ignore corrupt browser data. */
  }
  return result;
}
export function importableAnswers(
  guest: Record<string, string>,
  member: Record<string, string>,
): [string, string][] {
  return Object.entries(guest).filter(
    ([key, text]) => validKey(key) && text.trim().length > 0 && member[key] === undefined,
  );
}
export function importableProgress(
  guest: Record<string, Progress>,
  member: Record<string, Progress>,
): [string, Progress][] {
  return Object.entries(guest).filter(
    ([key, value]) =>
      validKey(key) &&
      member[key] === undefined &&
      (value.status !== "NOT_STARTED" || value.bookmarked),
  );
}
