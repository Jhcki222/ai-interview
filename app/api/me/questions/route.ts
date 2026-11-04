import { NextResponse } from "next/server";
import { member, readBody, invalid, dbError } from "@/lib/auth/api";
import { savedQuestionSchema } from "@/lib/auth/validation";
import { z } from "zod";
import { isCompanyMigrationMissing, companyMigrationMessage } from "@/lib/auth/companies";
const fields = "id,question,note,company_id,created_at,updated_at";
export async function GET(request: Request) {
  const auth = await member(request);
  if (auth.error) return auth.error;
  const { data, error } = await auth.client
    .from("saved_questions")
    .select(fields)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (isCompanyMigrationMissing(error))
    return NextResponse.json(
      { error: companyMigrationMessage, code: "MIGRATION_REQUIRED" },
      { status: 503 },
    );
  return error ? dbError() : NextResponse.json({ questions: data });
}
export async function POST(request: Request) {
  const auth = await member(request, true);
  if (auth.error) return auth.error;
  let question;
  let companyId: string | null = null;
  try {
    const body = await readBody(request);
    if (body.question && typeof body.question === "object") {
      const parsed = z
        .object({ question: savedQuestionSchema, company_id: z.uuid().nullable().optional() })
        .strict()
        .parse(body);
      question = parsed.question;
      companyId = parsed.company_id ?? null;
    } else question = savedQuestionSchema.parse(body);
  } catch {
    return invalid();
  }
  if (companyId) {
    const company = await auth.client
      .from("company_collections")
      .select("id")
      .eq("id", companyId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (isCompanyMigrationMissing(company.error))
      return NextResponse.json(
        { error: companyMigrationMessage, code: "MIGRATION_REQUIRED" },
        { status: 503 },
      );
    if (company.error) return dbError();
    if (!company.data) return invalid();
  }
  const { data, error } = await auth.client
    .from("saved_questions")
    .insert({ user_id: auth.user.id, question, company_id: companyId })
    .select(fields)
    .single();
  if (error?.code === "23505") {
    // Database uniqueness serializes concurrent saves. Keep the first private snapshot intact.
    const existing = await auth.client
      .from("saved_questions")
      .select(fields)
      .eq("user_id", auth.user.id)
      .eq("source_question_id", question.id)
      .single();
    return existing.error || !existing.data
      ? dbError()
      : NextResponse.json({ question: existing.data, alreadySaved: true });
  }
  if (isCompanyMigrationMissing(error))
    return NextResponse.json(
      { error: companyMigrationMessage, code: "MIGRATION_REQUIRED" },
      { status: 503 },
    );
  if (error?.code === "23503") return invalid();
  return error ? dbError() : NextResponse.json({ question: data }, { status: 201 });
}
