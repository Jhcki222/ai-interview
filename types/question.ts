export type CategoryId =
  "CS" | "BACKEND" | "AI" | "PERSONALITY" | "MOTIVATION" | "BUSINESS" | "PROJECTS";
export type Difficulty = "BASIC" | "INTERMEDIATE" | "ADVANCED";
export type Importance = "ESSENTIAL" | "IMPORTANT" | "ADVANCED";
export type LearningStatus = "NOT_STARTED" | "IN_PROGRESS" | "NEEDS_REVIEW" | "COMPLETED";
export interface ModelAnswer {
  summary: string;
  interviewAnswer: string;
  detailedExplanation: string;
  example: string;
  keywords: string[];
}
export interface FollowUp {
  id: string;
  question: string;
  modelAnswer: string;
}
export interface Question {
  id: string;
  category: CategoryId;
  subcategory: string;
  topic: string;
  difficulty: Difficulty;
  importance: Importance;
  question: string;
  modelAnswer: ModelAnswer;
  followUps: FollowUp[];
  source?: { type: string; evidence: string };
}
export interface Progress {
  status: LearningStatus;
  bookmarked: boolean;
}
