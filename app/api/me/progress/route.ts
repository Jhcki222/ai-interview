import { NextResponse } from "next/server";
import { member, readBody, invalid, dbError, ownsQuestion } from "@/lib/auth/api";
import { progressSchema } from "@/lib/auth/validation";
export async function POST(request: Request) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  let payload;
  try {
    payload = progressSchema.parse(await readBody(request));
  } catch {
    return invalid();
  }
  if (!(await ownsQuestion(auth.client, auth.user.id, payload.question_key))) return invalid();
  const { error } = await auth.client
    .from("learning_progress")
    .upsert({ ...payload, user_id: auth.user.id }, { onConflict: "user_id,question_key" });
  return error ? dbError() : NextResponse.json({ ok: true });
}
