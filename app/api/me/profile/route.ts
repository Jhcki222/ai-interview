import { NextResponse } from "next/server";
import { z } from "zod";
import { member, readBody, invalid, dbError } from "@/lib/auth/api";
import { emailToUsername } from "@/lib/auth/forms";

export async function GET(request: Request) {
  const auth = await member(request);
  if (auth.error) return auth.error;
  const { data, error } = await auth.client
    .from("profiles")
    .select("nickname")
    .eq("id", auth.user.id)
    .maybeSingle();
  return error
    ? dbError()
    : NextResponse.json({
        nickname: data?.nickname ?? auth.user.user_metadata.nickname ?? "",
        username: auth.user.user_metadata.username ?? emailToUsername(auth.user.email),
        email: auth.user.email,
      });
}

export async function PATCH(request: Request) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  let body;
  try {
    body = z
      .object({ nickname: z.string().trim().min(2).max(40) })
      .strict()
      .parse(await readBody(request));
  } catch {
    return invalid();
  }
  const { error } = await auth.client
    .from("profiles")
    .upsert({ id: auth.user.id, nickname: body.nickname });
  if (error) return dbError();
  const { error: authError } = await auth.client.auth.updateUser({
    data: { nickname: body.nickname },
  });
  return authError ? dbError() : NextResponse.json({ ok: true });
}
