import { NextResponse } from "next/server";
import { z } from "zod";
import { member, readBody, invalid, dbError } from "@/lib/auth/api";
import { questionPatchSchema } from "@/lib/auth/validation";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  let payload;
  try {
    payload = questionPatchSchema.parse(await readBody(request));
  } catch {
    return invalid();
  }
  const { data, error } = await auth.client
    .from("saved_questions")
    .update(payload)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id,question,note,created_at,updated_at")
    .maybeSingle();
  return error
    ? dbError()
    : data
      ? NextResponse.json({ question: data })
      : NextResponse.json({ error: "질문을 찾을 수 없습니다." }, { status: 404 });
}
export async function DELETE(request: Request, { params }: Context) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  const { data, error } = await auth.client
    .from("saved_questions")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();
  return error
    ? dbError()
    : data
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "질문을 찾을 수 없습니다." }, { status: 404 });
}
