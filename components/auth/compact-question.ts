/**
 * Existing saved-question validation (and the Supabase snapshot check) requires
 * a full question shape. Keep that boundary unchanged while letting the user
 * enter only a company, category, question and answer.
 *
 * The two follow-up entries below are schema-compatibility placeholders, not
 * real follow-up questions. Presentation components must hide them for a
 * COMPACT_MANUAL question.
 */
import type { CategoryId, Question } from "@/types/question";

const COMPACT_SOURCE = "COMPACT_MANUAL";

export function isCompactManualQuestion(question: Question): boolean {
  return question.source?.type === COMPACT_SOURCE;
}

export function compactAnswer(answer: string): Question["modelAnswer"] {
  return {
    summary: answer,
    interviewAnswer: answer,
    detailedExplanation: answer,
    example: answer,
    keywords: [],
  };
}

export function createCompactQuestion(
  category: CategoryId,
  question: string,
  answer: string,
): Question {
  return {
    id: `custom-${crypto.randomUUID()}`,
    category,
    subcategory: "직접 작성",
    topic: "직접 작성",
    difficulty: "INTERMEDIATE",
    importance: "IMPORTANT",
    question,
    modelAnswer: compactAnswer(answer),
    followUps: [1, 2].map((number) => ({
      id: `unwritten-follow-up-${number}`,
      question: "(꼬리질문 미작성)",
      modelAnswer: "(꼬리질문 답변 미작성)",
    })),
    source: { type: COMPACT_SOURCE, evidence: "" },
  };
}

export function updateCompactQuestion(
  original: Question,
  category: CategoryId,
  question: string,
  answer: string,
): Question {
  return {
    ...original,
    category,
    question,
    modelAnswer: compactAnswer(answer),
    // Preserve existing hidden metadata and its original source marker.
  };
}

/** Preserve the database snapshot shape while hiding unfilled compatibility entries. */
export function withCompactFollowups(
  question: Question,
  followUps: Question["followUps"],
): Question {
  const items = [...followUps];
  while (items.length < 2)
    items.push({
      id: `unwritten-follow-up-${items.length + 1}`,
      question: "(꼬리질문 미작성)",
      modelAnswer: "(꼬리질문 답변 미작성)",
    });
  return { ...question, followUps: items };
}
