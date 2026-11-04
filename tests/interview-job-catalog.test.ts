import { describe, expect, it } from "vitest";
import { INDUSTRIES, JOB_GROUPS } from "../lib/interview/job-catalog";

describe("interview industry and role catalog", () => {
  it("keeps industries distinct from roles and supplies unique stable identifiers", () => {
    expect(INDUSTRIES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(INDUSTRIES.map((item) => item.id)).size).toBe(INDUSTRIES.length);
    expect(new Set(INDUSTRIES.map((item) => item.label)).size).toBe(INDUSTRIES.length);
    expect(INDUSTRIES.every((item) => item.id.trim() && item.label.trim())).toBe(true);
    expect(INDUSTRIES.some((item) => item.label.includes("은행"))).toBe(true);
    expect(INDUSTRIES.some((item) => item.label.includes("공공"))).toBe(true);
    expect(INDUSTRIES.some((item) => item.label.includes("DevOps"))).toBe(false);
  });
  it("offers 60–80 distinct role labels grouped by work rather than industry", () => {
    const roles = JOB_GROUPS.flatMap((group) => group.roles);
    expect(roles.length).toBeGreaterThanOrEqual(60);
    expect(roles.length).toBeLessThanOrEqual(80);
    expect(new Set(roles).size).toBe(roles.length);
    expect(new Set(JOB_GROUPS.map((group) => group.id)).size).toBe(JOB_GROUPS.length);
    expect(JOB_GROUPS.every((group) => group.label.trim() && group.roles.length > 0)).toBe(true);
    expect(roles.every((role) => role.trim() === role && role.length > 0)).toBe(true);
    expect(roles).toContain("백엔드 개발자");
    for (const required of ["AI", "서비스 개발", "인프라", "DevOps", "은행 IT", "공공 전산"])
      expect(roles.some((role) => role.includes(required))).toBe(true);
  });
  it("keeps catalog values serializable for client form state", () => {
    // Importing the data module in a plain test runtime must expose serializable constants.
    const parsed = JSON.parse(JSON.stringify({ industries: INDUSTRIES, groups: JOB_GROUPS }));
    expect(parsed.groups[0].roles).toContain("백엔드 개발자");
    expect(parsed.industries.length).toBe(INDUSTRIES.length);
  });
});
