import { NextResponse } from "next/server";
import { member, readBody, invalid, dbError, ownsQuestion } from "@/lib/auth/api";
import { importSchema } from "@/lib/learning/import";
export async function POST(request: Request) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  let body;
  try {
    body = importSchema.parse(await readBody(request));
  } catch {
    return invalid();
  }
  const keys = new Set([...body.answers, ...body.progress].map((item) => item.question_key));
  for (const key of keys)
    if (!(await ownsQuestion(auth.client, auth.user.id, key))) return invalid();
  let insertedAnswers: string[] = [],
    insertedProgress: string[] = [];
  if (body.answers.length) {
    const { data, error } = await auth.client
      .from("user_answers")
      .upsert(
        body.answers.map((item) => ({ ...item, user_id: auth.user.id })),
        { onConflict: "user_id,question_key", ignoreDuplicates: true },
      )
      .select("question_key");
    if (error) return dbError();
    insertedAnswers = (data ?? []).map((item) => item.question_key);
  }
  if (body.progress.length) {
    const { data, error } = await auth.client
      .from("learning_progress")
      .upsert(
        body.progress.map((item) => ({ ...item, user_id: auth.user.id })),
        { onConflict: "user_id,question_key", ignoreDuplicates: true },
      )
      .select("question_key");
    if (error) return dbError();
    insertedProgress = (data ?? []).map((item) => item.question_key);
  }
  return NextResponse.json({ ok: true, insertedAnswers, insertedProgress });
}
