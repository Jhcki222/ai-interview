import cs from "../data/questions/cs.json";
import backend from "../data/questions/backend.json";
import ai from "../data/questions/ai.json";
import personality from "../data/questions/personality.json";
import motivation from "../data/questions/motivation.json";
import business from "../data/questions/business.json";
import projects from "../data/questions/projects.json";
import type { CategoryId, Question } from "../types/question";

export const categories: { id: CategoryId; name: string; description: string }[] = [
  {
    id: "CS",
    name: "CS 기초",
    description: "자료구조, 알고리즘, 운영체제, 네트워크와 데이터베이스",
  },
  { id: "BACKEND", name: "백엔드", description: "API, 인증, 데이터 처리와 안정적인 서비스 운영" },
  { id: "AI", name: "AI·데이터", description: "머신러닝, 딥러닝, 생성형 AI와 모델 평가" },
  { id: "PERSONALITY", name: "인성·협업", description: "협업, 의사소통, 책임감과 문제 해결 경험" },
  { id: "MOTIVATION", name: "지원동기", description: "지원 이유, 직무 이해와 성장 방향" },
  { id: "BUSINESS", name: "기업·비즈니스", description: "고객 가치, 사업 지표와 기술 의사결정" },
  { id: "PROJECTS", name: "프로젝트", description: "설계, 구현, 검증과 프로젝트 회고" },
];
export const questions = [
  ...cs,
  ...backend,
  ...ai,
  ...personality,
  ...motivation,
  ...business,
  ...projects,
] as Question[];
const byId = new Map(questions.map((q) => [q.id, q]));
export function getQuestion(id: string): Question | undefined {
  return byId.get(id);
}
export const difficultyLabels = { BASIC: "기초", INTERMEDIATE: "중급", ADVANCED: "심화" };
export const importanceLabels = { ESSENTIAL: "필수", IMPORTANT: "중요", ADVANCED: "심화" };
export interface QuestionFilters {
  query?: string;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  importance?: string;
}
export function filterQuestions(items: Question[], filters: QuestionFilters): Question[] {
  const terms = filters.query?.trim().toLocaleLowerCase("ko").split(/\s+/).filter(Boolean) ?? [];
  return items.filter((q) => {
    for (const key of ["category", "subcategory", "difficulty", "importance"] as const) {
      if (filters[key] && filters[key] !== "ALL" && q[key] !== filters[key]) return false;
    }
    const haystack = [q.question, q.topic, q.subcategory, ...q.modelAnswer.keywords]
      .join(" ")
      .toLocaleLowerCase("ko");
    return terms.every((term) => haystack.includes(term));
  });
}
