import { NextResponse } from "next/server";
import { member, readBody, invalid, dbError, ownsQuestion } from "@/lib/auth/api";
import { answerSchema, questionKeySchema } from "@/lib/auth/validation";
export async function POST(request: Request) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  let payload;
  try {
    payload = answerSchema.parse(await readBody(request));
  } catch {
    return invalid();
  }
  if (!(await ownsQuestion(auth.client, auth.user.id, payload.question_key))) return invalid();
  const { error } = await auth.client
    .from("user_answers")
    .upsert({ ...payload, user_id: auth.user.id }, { onConflict: "user_id,question_key" });
  return error ? dbError() : NextResponse.json({ ok: true });
}
export async function DELETE(request: Request) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  const key = questionKeySchema.safeParse(new URL(request.url).searchParams.get("question_key"));
  if (!key.success) return invalid();
  const { error } = await auth.client
    .from("user_answers")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("question_key", key.data);
  return error ? dbError() : NextResponse.json({ ok: true });
}
