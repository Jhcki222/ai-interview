import { NextResponse } from "next/server";
import { member, readBody, invalid, dbError } from "@/lib/auth/api";
import { savedQuestionSchema } from "@/lib/auth/validation";
export async function GET(request: Request) {
  const auth = await member(request);
  if (auth.error) return auth.error;
  const { data, error } = await auth.client
    .from("saved_questions")
    .select("id,question,note,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });
  return error ? dbError() : NextResponse.json({ questions: data });
}
export async function POST(request: Request) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  let question;
  try {
    const body = await readBody(request);
    question = savedQuestionSchema.parse(
      body.question && typeof body.question === "object" ? body.question : body,
    );
  } catch {
    return invalid();
  }
  const { data, error } = await auth.client
    .from("saved_questions")
    .insert({ user_id: auth.user.id, question })
    .select("id,question,note,created_at,updated_at")
    .single();
  if (error?.code === "23505") {
    // Database uniqueness serializes concurrent saves. Keep the first private snapshot intact.
    const existing = await auth.client
      .from("saved_questions")
      .select("id,question,note,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .eq("source_question_id", question.id)
      .single();
    return existing.error || !existing.data
      ? dbError()
      : NextResponse.json({ question: existing.data, alreadySaved: true });
  }
  return error ? dbError() : NextResponse.json({ question: data }, { status: 201 });
}
