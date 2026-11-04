import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQuestion } from "@/lib/questions";
import { readBoundedText } from "@/lib/ai/request-body";
export async function member(request: Request, mutating = false) {
  if (mutating) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      return {
        error: NextResponse.json({ error: "요청 출처를 확인할 수 없습니다." }, { status: 403 }),
      } as const;
  }
  const client = await createClient();
  if (!client)
    return {
      error: NextResponse.json({ error: "Supabase 연결 설정이 필요합니다." }, { status: 503 }),
    } as const;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    return {
      error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }),
    } as const;
  return { client, user: data.user } as const;
}
export async function readBody(request: Request) {
  const text = await readBoundedText(request.body);
  if (text.length > 200000) throw new Error("too large");
  return JSON.parse(text);
}
export function invalid() {
  return NextResponse.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 });
}
export function dbError() {
  return NextResponse.json(
    { error: "저장소 요청에 실패했습니다. 잠시 후 다시 시도해 주세요." },
    { status: 500 },
  );
}
export async function ownsQuestion(
  client: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
  key: string,
) {
  if (key.startsWith("base:")) return !!getQuestion(key.slice(5));
  const { data, error } = await client
    .from("saved_questions")
    .select("id")
    .eq("id", key.slice(6))
    .eq("user_id", userId)
    .maybeSingle();
  return !error && !!data;
}
