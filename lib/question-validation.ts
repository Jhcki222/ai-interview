import type { CategoryId } from "../types/question";

export const categoryIds: CategoryId[] = [
  "CS",
  "BACKEND",
  "AI",
  "PERSONALITY",
  "MOTIVATION",
  "BUSINESS",
  "PROJECTS",
];
export function validateQuestions(value: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(value)) return ["questions must be an array"];
  const ids = new Set<string>();
  const titles = new Set<string>();
  const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  for (const [index, item] of value.entries()) {
    const q = item as Record<string, unknown>;
    const prefix = text(q?.id) ? q.id : String(index);
    if (!q || typeof q !== "object") {
      errors.push(`${prefix}: invalid question`);
      continue;
    }
    for (const field of ["id", "subcategory", "topic", "question"])
      if (!text(q[field])) errors.push(`${prefix}: missing ${field}`);
    if (ids.has(String(q.id))) errors.push(`${prefix}: duplicate id`);
    ids.add(String(q.id));
    if (titles.has(String(q.question))) errors.push(`${prefix}: duplicate question`);
    titles.add(String(q.question));
    if (!categoryIds.includes(q.category as CategoryId)) errors.push(`${prefix}: invalid category`);
    if (!["BASIC", "INTERMEDIATE", "ADVANCED"].includes(String(q.difficulty)))
      errors.push(`${prefix}: invalid difficulty`);
    if (!["ESSENTIAL", "IMPORTANT", "ADVANCED"].includes(String(q.importance)))
      errors.push(`${prefix}: invalid importance`);
    const answer = q.modelAnswer as Record<string, unknown> | undefined;
    for (const field of ["summary", "interviewAnswer", "detailedExplanation", "example"])
      if (!text(answer?.[field])) errors.push(`${prefix}: modelAnswer.${field}`);
    if (
      !Array.isArray(answer?.keywords) ||
      answer.keywords.length < 2 ||
      !answer.keywords.every(text)
    )
      errors.push(`${prefix}: modelAnswer.keywords`);
    if (!Array.isArray(q.followUps) || q.followUps.length < 2)
      errors.push(`${prefix}: followUps require two answers`);
    else {
      const followIds = new Set<string>();
      const followTexts = new Set<string>();
      for (const [i, follow] of q.followUps.entries()) {
        if (!text(follow?.id) || followIds.has(follow.id))
          errors.push(`${prefix}: followUps.${i}.id`);
        if (!text(follow?.question) || followTexts.has(follow.question))
          errors.push(`${prefix}: followUps.${i}.question`);
        if (!text(follow?.modelAnswer)) errors.push(`${prefix}: followUps.${i}.modelAnswer`);
        followIds.add(follow?.id);
        followTexts.add(follow?.question);
      }
    }
  }
  return errors;
}
