import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { QuestionWorkspace } from "@/components/questions/question-workspace";
import { getQuestion, questions } from "@/lib/questions";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const question = getQuestion(id);
  return { title: question?.question ?? "질문을 찾을 수 없어요" };
}
export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = getQuestion(id);
  if (!question) notFound();
  return <QuestionWorkspace questions={questions} detail={question} />;
}
