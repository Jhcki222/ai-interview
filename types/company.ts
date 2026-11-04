export const COMPANY_STAGES = ["PREPARING", "APPLIED", "INTERVIEW", "COMPLETED"] as const;
export type CompanyStage = (typeof COMPANY_STAGES)[number];
export interface CompanyCollection {
  id: string;
  name: string;
  position: string;
  stage: CompanyStage;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}
