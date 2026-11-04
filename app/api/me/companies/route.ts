import { NextResponse } from "next/server";
import { member, readBody, invalid, dbError } from "@/lib/auth/api";
import {
  companyInputSchema,
  isCompanyMigrationMissing,
  companyMigrationMessage,
} from "@/lib/auth/companies";
export async function GET(request: Request) {
  const auth = await member(request);
  if (auth.error) return auth.error;
  const { data, error } = await auth.client
    .from("company_collections")
    .select("id,name,position,stage,deadline,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (isCompanyMigrationMissing(error))
    return NextResponse.json(
      { error: companyMigrationMessage, code: "MIGRATION_REQUIRED" },
      { status: 503 },
    );
  return error ? dbError() : NextResponse.json({ companies: data });
}
export async function POST(request: Request) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  let payload;
  try {
    payload = companyInputSchema.parse(await readBody(request));
  } catch {
    return invalid();
  }
  const { data, error } = await auth.client
    .from("company_collections")
    .insert({ ...payload, user_id: auth.user.id })
    .select("id,name,position,stage,deadline,created_at,updated_at")
    .single();
  if (isCompanyMigrationMissing(error))
    return NextResponse.json(
      { error: companyMigrationMessage, code: "MIGRATION_REQUIRED" },
      { status: 503 },
    );
  if (error?.code === "23505")
    return NextResponse.json({ error: "같은 기업과 지원 직무가 이미 있습니다." }, { status: 409 });
  return error ? dbError() : NextResponse.json({ company: data }, { status: 201 });
}
