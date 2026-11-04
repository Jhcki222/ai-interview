import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  insert: vi.fn(),
  existing: vi.fn(),
  filters: [] as [string, string][],
}));
vi.mock("@/lib/auth/api", () => ({
  member: async () => ({
    user: { id: "member-one" },
    client: {
      from: () => ({
        insert: db.insert,
        select: () => {
          const query = {
            eq: (key: string, value: string) => {
              db.filters.push([key, value]);
              return query;
            },
            single: db.existing,
          };
          return query;
        },
      }),
    },
  }),
  readBody: (request: Request) => request.json(),
  invalid: () => Response.json({ error: "invalid" }, { status: 400 }),
  dbError: () => Response.json({ error: "database" }, { status: 500 }),
}));
import { POST } from "../app/api/me/questions/route";
const question = {
  id: "original-http",
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
beforeEach(() => {
  vi.clearAllMocks();
  db.filters.length = 0;
});
it("returns the original saved snapshot on a concurrent identity collision without overwriting it", async () => {
  const original = {
    id: "saved-record",
    question: { ...question, question: "처음 저장한 스냅샷" },
    note: "개인 메모",
  };
  db.insert.mockReturnValue({
    select: () => ({ single: async () => ({ data: null, error: { code: "23505" } }) }),
  });
  db.existing.mockResolvedValue({ data: original, error: null });
  const response = await POST(
    new Request("http://localhost/api/me/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...question, question: "나중에 바뀐 원본" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ question: original, alreadySaved: true });
  expect(db.filters).toEqual([
    ["user_id", "member-one"],
    ["source_question_id", "original-http"],
  ]);
  expect(db.insert).toHaveBeenCalledTimes(1);
});
it("accepts frontend category questions for member snapshots", async () => {
  const saved = {
    ...question,
    id: "frontend-react",
    category: "FRONTEND",
    subcategory: "React 렌더링",
    topic: "React state",
    question: "React 상태 변경은 화면에 어떻게 반영되나요?",
  };
  db.insert.mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: "saved-frontend", question: saved }, error: null }) }),
  });
  const response = await POST(
    new Request("http://localhost/api/me/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saved),
    }),
  );
  expect(response.status).toBe(201);
  expect(db.insert).toHaveBeenCalledTimes(1);
});
