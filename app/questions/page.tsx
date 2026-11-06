import type { Metadata } from "next";
import { QuestionWorkspace } from "@/components/questions/question-workspace";
import { questions } from "@/lib/questions";
export const metadata: Metadata = { title: "질문 학습" };
export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; company?: string }>;
}) {
  const params = await searchParams;
  return (
    <QuestionWorkspace
      questions={questions}
      initialCategory={typeof params.category === "string" ? params.category : ""}
      initialQuery={typeof params.q === "string" ? params.q : ""}
      suggestedCompanyId={typeof params.company === "string" ? params.company : undefined}
    />
  );
}
