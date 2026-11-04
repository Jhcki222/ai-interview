import type { CategoryId, Progress, Question } from "@/types/question";
export type SavedQuestionRecord = {
  id: string;
  question: Question;
  note: string;
  company_id?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type MemberLearningState = {
  answers: Record<string, string>;
  progress: Record<string, Progress>;
  updatedAt?: Record<string, string>;
};
export function filterSavedQuestions(rows: SavedQuestionRecord[], query: string, category: string) {
  const terms = query.toLocaleLowerCase("ko").trim().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (category !== "ALL" && row.question.category !== category) return false;
    const searchable = [
      row.question.question,
      row.question.subcategory,
      row.question.topic,
      ...row.question.modelAnswer.keywords,
      row.note,
    ]
      .join(" ")
      .toLocaleLowerCase("ko");
    return terms.every((term) => searchable.includes(term));
  });
}
export function buildMemberDashboard(
  base: Question[],
  saved: SavedQuestionRecord[],
  state: MemberLearningState,
) {
  const all = new Map<string, Question>([
    ...base.map((q) => [`base:${q.id}`, q] as const),
    ...saved.map((row) => [`saved:${row.id}`, row.question] as const),
  ]);
  const categories = Object.fromEntries(
    (["CS", "BACKEND", "AI", "PERSONALITY", "MOTIVATION", "BUSINESS", "PROJECTS"] as const).map(
      (category) => [category, { total: 0, answered: 0, completed: 0 }],
    ),
  ) as Record<CategoryId, { total: number; answered: number; completed: number }>;
  const metrics = { total: all.size, answered: 0, completed: 0, needsReview: 0, bookmarked: 0 };
  for (const [key, question] of all) {
    const answered = !!state.answers[key]?.trim();
    const progress = state.progress[key];
    categories[question.category].total++;
    if (answered) {
      metrics.answered++;
      categories[question.category].answered++;
    }
    if (progress?.status === "COMPLETED") {
      metrics.completed++;
      categories[question.category].completed++;
    }
    if (progress?.status === "NEEDS_REVIEW") metrics.needsReview++;
    if (progress?.bookmarked) metrics.bookmarked++;
  }
  const activity = { ...state.updatedAt };
  for (const row of saved) {
    const key = `saved:${row.id}`;
    const updated = row.updated_at ?? row.created_at;
    if (updated && (!activity[key] || Date.parse(updated) > Date.parse(activity[key])))
      activity[key] = updated;
  }
  const recent = Object.entries(activity)
    .filter(([key, date]) => all.has(key) && Number.isFinite(Date.parse(date)))
    .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
    .slice(0, 8)
    .map(([key, updatedAt]) => ({
      key,
      updatedAt,
      question: all.get(key)!,
      progress: state.progress[key],
      answered: !!state.answers[key]?.trim(),
    }));
  return { metrics, categories, recent };
}
