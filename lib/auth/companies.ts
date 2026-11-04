import { z } from "zod";
import { COMPANY_STAGES, type CompanyCollection, type CompanyStage } from "@/types/company";
export const companyStageLabels: Record<CompanyStage, string> = {
  PREPARING: "준비 중",
  APPLIED: "서류 전형",
  INTERVIEW: "면접",
  COMPLETED: "마무리",
};
export const companyInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    position: z.string().trim().max(150).default(""),
    stage: z.enum(COMPANY_STAGES).default("PREPARING"),
    deadline: z.iso.date().nullable().default(null),
  })
  .strict();
export const companyPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    position: z.string().trim().max(150).optional(),
    stage: z.enum(COMPANY_STAGES).optional(),
    deadline: z.iso.date().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export function groupCompanies(companies: CompanyCollection[], query: string) {
  const result: Record<CompanyStage, CompanyCollection[]> = {
    PREPARING: [],
    APPLIED: [],
    INTERVIEW: [],
    COMPLETED: [],
  };
  const terms = query.toLocaleLowerCase("ko").trim().split(/\s+/).filter(Boolean);
  for (const company of companies)
    if (
      terms.every((term) =>
        `${company.name} ${company.position}`.toLocaleLowerCase("ko").includes(term),
      )
    )
      result[company.stage].push(company);
  return result;
}
export function filterCompanyQuestions<T extends { company_id?: string | null }>(
  questions: T[],
  companyId: string,
): T[] {
  return companyId === "ALL"
    ? questions
    : questions.filter((question) =>
        companyId === "UNASSIGNED" ? !question.company_id : question.company_id === companyId,
      );
}
export function isCompanyMigrationMissing(error: { code?: string } | null | undefined) {
  return !!error && ["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? "");
}
export const companyMigrationMessage =
  "기업별 질문 관리를 사용하려면 Supabase에서 003_company_collections.sql 마이그레이션을 적용해 주세요.";
export function resolveSavedQuestionDeepLink(
  questions: { id: string; company_id?: string | null }[],
  search: string,
  hash: string,
) {
  try {
    const query = new URLSearchParams(search).get("question");
    const fromHash = hash.startsWith("#saved-") ? decodeURIComponent(hash.slice(7)) : null;
    const id = query || fromHash;
    if (!id) return null;
    const question = questions.find((row) => row.id === id);
    return question
      ? { questionId: question.id, companyFilter: question.company_id || "UNASSIGNED" }
      : null;
  } catch {
    return null;
  }
}
