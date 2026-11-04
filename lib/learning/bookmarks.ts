import type { Question, Progress } from "@/types/question";
import type { SavedQuestionRecord, MemberLearningState } from "@/lib/auth/member-learning";
export interface BookmarkEntry {
  key: string;
  question: Question;
  source: "base" | "created";
  answer: string;
  progress: Progress;
  updatedAt: string;
}
export function resolveBookmarks(
  base: Question[],
  saved: SavedQuestionRecord[],
  state: MemberLearningState,
): BookmarkEntry[] {
  const lookup = new Map<string, { question: Question; source: "base" | "created" }>([
    ...base.map(
      (question) => [`base:${question.id}`, { question, source: "base" as const }] as const,
    ),
    ...saved.map(
      (record) =>
        [`saved:${record.id}`, { question: record.question, source: "created" as const }] as const,
    ),
  ]);
  return Object.entries(state.progress)
    .flatMap(([key, progress]) => {
      const found = lookup.get(key);
      return progress.bookmarked && found
        ? [
            {
              key,
              ...found,
              answer: state.answers[key] ?? "",
              progress,
              updatedAt: state.updatedAt?.[key] ?? "",
            },
          ]
        : [];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.key.localeCompare(b.key));
}
export function filterBookmarks(
  entries: BookmarkEntry[],
  filters: { query?: string; category?: string; status?: string; source?: string },
) {
  const words = (filters.query ?? "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      (!filters.category || entry.question.category === filters.category) &&
      (!filters.status || entry.progress.status === filters.status) &&
      (!filters.source || entry.source === filters.source) &&
      words.every((word) =>
        [
          entry.question.question,
          entry.question.topic,
          entry.question.subcategory,
          ...entry.question.modelAnswer.keywords,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(word),
      ),
  );
}
