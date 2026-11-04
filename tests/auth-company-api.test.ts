import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  results: [] as unknown[],
  calls: [] as {
    table: string;
    operation?: string;
    value?: unknown;
    filters: [string, string][];
  }[],
  authError: false,
}));
vi.mock("@/lib/auth/api", () => ({
  member: async () =>
    db.authError
      ? { error: Response.json({ error: "login" }, { status: 401 }) }
      : {
          user: { id: "owner" },
          client: {
            from: (table: string) => {
              const call = {
                table,
                filters: [] as [string, string][],
                operation: "",
                value: undefined as unknown,
              };
              db.calls.push(call);
              const query = {
                select: () => query,
                eq: (key: string, value: string) => {
                  call.filters.push([key, value]);
                  return query;
                },
                update: (value: unknown) => {
                  call.operation = "update";
                  call.value = value;
                  return query;
                },
                insert: (value: unknown) => {
                  call.operation = "insert";
                  call.value = value;
                  return query;
                },
                delete: () => {
                  call.operation = "delete";
                  return query;
                },
                order: async () => db.results.shift(),
                single: async () => db.results.shift(),
                maybeSingle: async () => db.results.shift(),
              };
              return query;
            },
          },
        },
  readBody: (request: Request) => request.json(),
  invalid: () => Response.json({ error: "invalid" }, { status: 400 }),
  dbError: () => Response.json({ error: "database" }, { status: 500 }),
}));
import { GET } from "../app/api/me/companies/route";
import { PATCH, DELETE } from "../app/api/me/companies/[id]/route";
import { POST as saveQuestion } from "../app/api/me/questions/route";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  db.calls.length = 0;
  db.results.length = 0;
  db.authError = false;
});
it("returns an explicit migration-required response when the company table is absent", async () => {
  db.results.push({ data: null, error: { code: "PGRST205" } });
  const response = await GET(new Request("http://localhost/api/me/companies"));
  expect(response.status).toBe(503);
  expect((await response.json()).code).toBe("MIGRATION_REQUIRED");
});
it("changes only the supplied stage and scopes company writes to the authenticated owner", async () => {
  db.results.push({ data: { id, stage: "INTERVIEW" }, error: null });
  const response = await PATCH(
    new Request(`http://localhost/api/me/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ stage: "INTERVIEW" }),
    }),
    { params: Promise.resolve({ id }) },
  );
  expect(response.status).toBe(200);
  expect(db.calls[0]).toMatchObject({
    table: "company_collections",
    operation: "update",
    value: { stage: "INTERVIEW" },
    filters: [
      ["id", id],
      ["user_id", "owner"],
    ],
  });
});
it("deletes only the company row, leaving question preservation to the owner FK", async () => {
  db.results.push({ data: { id }, error: null });
  expect(
    (
      await DELETE(new Request(`http://localhost/api/me/companies/${id}`, { method: "DELETE" }), {
        params: Promise.resolve({ id }),
      })
    ).status,
  ).toBe(200);
  expect(db.calls).toHaveLength(1);
  expect(db.calls[0]).toMatchObject({
    table: "company_collections",
    operation: "delete",
    filters: [
      ["id", id],
      ["user_id", "owner"],
    ],
  });
});
it("rejects company operations before accessing storage when unauthenticated", async () => {
  db.authError = true;
  expect((await GET(new Request("http://localhost/api/me/companies"))).status).toBe(401);
  expect(db.calls).toEqual([]);
});
it("rejects assigning a saved snapshot to another owners company before insertion", async () => {
  db.results.push({ data: null, error: null });
  const question = {
    id: "custom-q",
    category: "CS",
    subcategory: "network",
    topic: "HTTP",
    difficulty: "BASIC",
    importance: "ESSENTIAL",
    question: "HTTP란?",
    modelAnswer: {
      summary: "요약",
      interviewAnswer: "답변",
      detailedExplanation: "설명",
      example: "예시",
      keywords: ["HTTP"],
    },
    followUps: [
      { id: "f1", question: "질문1", modelAnswer: "답변1" },
      { id: "f2", question: "질문2", modelAnswer: "답변2" },
    ],
  };
  const response = await saveQuestion(
    new Request("http://localhost/api/me/questions", {
      method: "POST",
      body: JSON.stringify({ question, company_id: id }),
    }),
  );
  expect(response.status).toBe(400);
  expect(db.calls).toHaveLength(1);
  expect(db.calls[0]).toMatchObject({
    table: "company_collections",
    filters: [
      ["id", id],
      ["user_id", "owner"],
    ],
  });
});
