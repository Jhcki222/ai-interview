import { NextResponse } from "next/server";
import { member, dbError } from "@/lib/auth/api";
export async function GET(request: Request) {
  const auth = await member(request);
  if (auth.error) return auth.error;
  const [answers, progress] = await Promise.all([
    auth.client
      .from("user_answers")
      .select("question_key,answer_text,updated_at")
      .eq("user_id", auth.user.id),
    auth.client
      .from("learning_progress")
      .select("question_key,status,bookmarked,updated_at")
      .eq("user_id", auth.user.id),
  ]);
  if (answers.error || progress.error) return dbError();
  const updatedAt: Record<string, string> = {};
  for (const row of [...answers.data, ...progress.data])
    if (
      !updatedAt[row.question_key] ||
      Date.parse(row.updated_at) > Date.parse(updatedAt[row.question_key])
    )
      updatedAt[row.question_key] = row.updated_at;
  return NextResponse.json({
    answers: Object.fromEntries(answers.data.map((v) => [v.question_key, v.answer_text])),
    progress: Object.fromEntries(
      progress.data.map((v) => [v.question_key, { status: v.status, bookmarked: v.bookmarked }]),
    ),
    updatedAt,
  });
}
