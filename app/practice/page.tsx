import type { Metadata } from "next";
import { QuestionWorkspace } from "@/components/questions/question-workspace";
import { questions } from "@/lib/questions";

export const metadata: Metadata = { title: "랜덤 질문 연습" };

export default function PracticePage() {
  return <QuestionWorkspace questions={questions} practice />;
}
