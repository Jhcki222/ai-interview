import type { Progress } from "@/types/question";
export function mergeProgress(current: Progress | undefined, patch: Partial<Progress>): Progress {
  return { status: "NOT_STARTED", bookmarked: false, ...current, ...patch };
}
export const LEARNING_CHANGED = "interview-learning-changed";
export function notifyLearningChanged(owner: string, source?: object) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(LEARNING_CHANGED, { detail: { owner, source } }));
}
