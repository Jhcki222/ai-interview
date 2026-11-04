import { describe, expect, it } from "vitest";
import {
  companyInputSchema,
  companyPatchSchema,
  groupCompanies,
  filterCompanyQuestions,
} from "../lib/auth/companies";
import type { CompanyCollection } from "../types/company";
const company: CompanyCollection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "토스",
  position: "백엔드 개발자",
  stage: "INTERVIEW",
  deadline: "2026-11-20",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};
describe("company collections", () => {
  it("normalizes company names and rejects invalid dates and owner injection", () => {
    expect(
      companyInputSchema.parse({
        name: " 토스 ",
        position: " 개발자 ",
        stage: "PREPARING",
        deadline: null,
      }),
    ).toMatchObject({ name: "토스", position: "개발자" });
    expect(companyInputSchema.safeParse({ name: " ", stage: "PREPARING" }).success).toBe(false);
    expect(companyInputSchema.safeParse({ name: "회사", deadline: "2026-13-01" }).success).toBe(
      false,
    );
    expect(companyInputSchema.safeParse({ name: "회사", user_id: "other" }).success).toBe(false);
    expect(companyPatchSchema.safeParse({}).success).toBe(false);
  });
  it("groups company cards by real stage and searches company and position", () => {
    expect(groupCompanies([company], "백엔드").INTERVIEW).toEqual([company]);
    expect(groupCompanies([company], "없는 기업").INTERVIEW).toEqual([]);
  });
  it("preserves existing unassigned questions and filters a selected company", () => {
    const rows = [
      { id: "a", company_id: null },
      { id: "b", company_id: company.id },
    ];
    expect(filterCompanyQuestions(rows, "UNASSIGNED").map((row) => row.id)).toEqual(["a"]);
    expect(filterCompanyQuestions(rows, company.id).map((row) => row.id)).toEqual(["b"]);
    expect(filterCompanyQuestions(rows, "ALL")).toHaveLength(2);
  });
});
