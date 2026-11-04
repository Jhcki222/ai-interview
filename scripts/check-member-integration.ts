import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { questions } from "../lib/questions";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
  },
};
const admin = createClient(url, serverKey, options);
const created: string[] = [];
const check = (condition: unknown, step: string) => {
  if (!condition) throw new Error(step);
  console.log(JSON.stringify({ step, passed: true }));
};
try {
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const email = `integration-${randomUUID()}@example.invalid`,
      password = randomUUID() + "A1!";
    const result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nickname: "임시 검증 계정" },
    });
    if (result.error || !result.data.user) throw new Error("temporary-account-creation");
    created.push(result.data.user.id);
    const client = createClient(url, publicKey, options);
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw new Error("temporary-account-sign-in");
    clients.push(client);
  }
  check(clients.length === 2, "two-isolated-test-accounts");
  const [owner, other] = clients;
  const company = await owner
    .from("company_collections")
    .insert({
      user_id: created[0],
      name: "자동 검증 회사",
      position: "백엔드 개발자",
      stage: "PREPARING",
    })
    .select("id")
    .single();
  check(!company.error && !!company.data, "create-company");
  const saved = await owner
    .from("saved_questions")
    .insert({
      user_id: created[0],
      question: { ...questions[0], id: `test-${randomUUID()}` },
      company_id: company.data!.id,
    })
    .select("id,question")
    .single();
  check(!saved.error && !!saved.data, "save-question-in-company");
  const key = `saved:${saved.data!.id}`;
  const answer = await owner
    .from("user_answers")
    .insert({ user_id: created[0], question_key: key, answer_text: "통합 검증용 임시 답변" });
  check(!answer.error, "save-personal-answer");
  const progress = await owner
    .from("learning_progress")
    .insert({ user_id: created[0], question_key: key, status: "COMPLETED", bookmarked: true });
  check(!progress.error, "save-bookmark-and-status");
  const inaccessible = await other.from("saved_questions").select("id").eq("id", saved.data!.id);
  check(!inaccessible.error && inaccessible.data.length === 0, "rls-other-account-cannot-read");
  const tampered = await other
    .from("saved_questions")
    .update({ note: "cross-user-write-attempt" })
    .eq("id", saved.data!.id)
    .select("id");
  check(!tampered.error && tampered.data.length === 0, "rls-other-account-cannot-update");
  const foreignCompany = await other
    .from("saved_questions")
    .insert({
      user_id: created[1],
      question: { ...questions[0], id: `test-${randomUUID()}` },
      company_id: company.data!.id,
    });
  check(!!foreignCompany.error, "reject-cross-owner-company-assignment");
  const removed = await owner.from("company_collections").delete().eq("id", company.data!.id);
  check(!removed.error, "remove-test-company");
  const preserved = await owner
    .from("saved_questions")
    .select("company_id")
    .eq("id", saved.data!.id)
    .single();
  const retained = await owner
    .from("user_answers")
    .select("answer_text")
    .eq("question_key", key)
    .single();
  check(
    !preserved.error &&
      preserved.data.company_id === null &&
      !retained.error &&
      retained.data.answer_text === "통합 검증용 임시 답변",
    "company-removal-preserves-question-and-answer",
  );
  const partial = await owner
    .from("learning_progress")
    .update({ bookmarked: false })
    .eq("question_key", key)
    .select("status,bookmarked")
    .single();
  check(
    !partial.error && partial.data.status === "COMPLETED" && !partial.data.bookmarked,
    "bookmark-update-preserves-learning-status",
  );
  console.log(JSON.stringify({ integrationPassed: true }));
} catch (error) {
  console.error(
    JSON.stringify({
      integrationPassed: false,
      failedStep: error instanceof Error ? error.message : "unknown",
    }),
  );
  process.exitCode = 1;
} finally {
  // Delete only users created by this invocation; their synthetic fixture rows cascade.
  for (const id of created) {
    const removed = await admin.auth.admin.deleteUser(id);
    if (removed.error) {
      console.error(JSON.stringify({ cleanupFailed: true }));
      process.exitCode = 1;
    }
  }
  if (created.length) console.log(JSON.stringify({ temporaryAccountsCleaned: created.length }));
}
