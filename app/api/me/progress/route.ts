import { NextResponse } from "next/server";
import { member, readBody, invalid, dbError, ownsQuestion } from "@/lib/auth/api";
import { progressPatchSchema } from "@/lib/auth/validation";
export async function POST(request: Request) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  let payload;
  try {
    payload = progressPatchSchema.parse(await readBody(request));
  } catch {
    return invalid();
  }
  if (!(await ownsQuestion(auth.client, auth.user.id, payload.question_key))) return invalid();
  const { question_key, ...patch } = payload;
  const update = () =>
    auth.client
      .from("learning_progress")
      .update(patch)
      .eq("user_id", auth.user.id)
      .eq("question_key", question_key)
      .select("question_key")
      .maybeSingle();
  const existing = await update();
  if (existing.error) return dbError();
  if (existing.data) return NextResponse.json({ ok: true });
  const created = await auth.client
    .from("learning_progress")
    .insert({
      user_id: auth.user.id,
      question_key,
      status: payload.status ?? "NOT_STARTED",
      bookmarked: payload.bookmarked ?? false,
    });
  if (!created.error) return NextResponse.json({ ok: true });
  if (created.error.code === "23505") {
    const retried = await update();
    if (retried.error) return dbError();
    if (retried.data) return NextResponse.json({ ok: true });
    return NextResponse.json(
      { error: "학습 기록이 변경되었습니다. 다시 시도해 주세요." },
      { status: 409 },
    );
  }
  return dbError();
}
