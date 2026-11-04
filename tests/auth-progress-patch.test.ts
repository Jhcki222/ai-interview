import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  updates: [] as unknown[],
  inserts: [] as unknown[],
  results: [] as unknown[],
  insertResult: { error: null } as { error: null | { code: string } },
}));
vi.mock("@/lib/auth/api", () => ({
  member: async () => ({
    user: { id: "owner" },
    client: {
      from: () => ({
        update: (patch: unknown) => {
          db.updates.push(patch);
          const query = {
            eq: () => query,
            select: () => query,
            maybeSingle: async () => db.results.shift(),
          };
          return query;
        },
        insert: (payload: unknown) => {
          db.inserts.push(payload);
          return Promise.resolve(db.insertResult);
        },
      }),
    },
  }),
  readBody: (request: Request) => request.json(),
  ownsQuestion: async () => true,
  invalid: () => Response.json({ error: "invalid" }, { status: 400 }),
  dbError: () => Response.json({ error: "database" }, { status: 500 }),
}));
import { POST } from "../app/api/me/progress/route";
const request = (body: unknown) =>
  new Request("http://localhost/api/me/progress", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  db.updates.length = 0;
  db.inserts.length = 0;
  db.results.length = 0;
  db.insertResult = { error: null };
});
it("updates only bookmark when a status record already exists", async () => {
  db.results.push({ data: { question_key: "base:q" }, error: null });
  const response = await POST(request({ question_key: "base:q", bookmarked: true }));
  expect(response.status).toBe(200);
  expect(db.updates).toEqual([{ bookmarked: true }]);
  expect(db.inserts).toEqual([]);
});
it("retries only the requested status after another request creates the row", async () => {
  db.results.push({ data: null, error: null }, { data: { question_key: "base:q" }, error: null });
  db.insertResult = { error: { code: "23505" } };
  const response = await POST(request({ question_key: "base:q", status: "COMPLETED" }));
  expect(response.status).toBe(200);
  expect(db.updates).toEqual([{ status: "COMPLETED" }, { status: "COMPLETED" }]);
  expect(db.inserts).toEqual([
    { user_id: "owner", question_key: "base:q", status: "COMPLETED", bookmarked: false },
  ]);
});
it("rejects empty patches and owner injection before writing", async () => {
  expect((await POST(request({ question_key: "base:q" }))).status).toBe(400);
  expect(
    (await POST(request({ question_key: "base:q", bookmarked: true, user_id: "other" }))).status,
  ).toBe(400);
  expect(db.updates).toEqual([]);
});
