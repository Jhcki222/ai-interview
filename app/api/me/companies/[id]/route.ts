import { NextResponse } from "next/server";
import { z } from "zod";
import { member, readBody, invalid, dbError } from "@/lib/auth/api";
import {
  companyPatchSchema,
  isCompanyMigrationMissing,
  companyMigrationMessage,
} from "@/lib/auth/companies";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  let payload;
  try {
    payload = companyPatchSchema.parse(await readBody(request));
  } catch {
    return invalid();
  }
  const { data, error } = await auth.client
    .from("company_collections")
    .update(payload)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id,name,position,stage,deadline,created_at,updated_at")
    .maybeSingle();
  if (isCompanyMigrationMissing(error))
    return NextResponse.json(
      { error: companyMigrationMessage, code: "MIGRATION_REQUIRED" },
      { status: 503 },
    );
  if (error?.code === "23505")
    return NextResponse.json({ error: "같은 기업과 지원 직무가 이미 있습니다." }, { status: 409 });
  return error
    ? dbError()
    : data
      ? NextResponse.json({ company: data })
      : NextResponse.json({ error: "기업을 찾을 수 없습니다." }, { status: 404 });
}
export async function DELETE(request: Request, { params }: Context) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  const { data, error } = await auth.client
    .from("company_collections")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (isCompanyMigrationMissing(error))
    return NextResponse.json(
      { error: companyMigrationMessage, code: "MIGRATION_REQUIRED" },
      { status: 503 },
    );
  return error
    ? dbError()
    : data
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "기업을 찾을 수 없습니다." }, { status: 404 });
}
