import { it, expect } from "vitest";
import { extractDocuments } from "../lib/documents/extract";
import { namespaceQuestions } from "../lib/ai/question-identity";
import type { Question } from "../types/question";
it("cancels pending extraction before any downstream transmission and ignores late text", async () => {
  let finish!: (value: string) => void;
  let transmitted = false;
  const file = {
    name: "resume.txt",
    size: 10,
    text: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  } as File;
  const controller = new AbortController();
  const pending = extractDocuments([file], controller.signal).then(() => {
    transmitted = true;
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  finish("문서가 늦게 도착함");
  await Promise.resolve();
  expect(transmitted).toBe(false);
});
it("does not start reading pre-canceled files", async () => {
  let reads = 0;
  const controller = new AbortController();
  controller.abort();
  const file = {
    name: "resume.txt",
    size: 10,
    text: async () => {
      reads++;
      return "문서";
    },
  } as File;
  await expect(extractDocuments([file], controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(reads).toBe(0);
});
it("namespaces model question and follow-up ids by session with bounded lengths", () => {
  const question = { id: "model-id", followUps: [{ id: "f1" }, { id: "f2" }] } as Question;
  const a = namespaceQuestions([question], "a".repeat(64));
  const b = namespaceQuestions([question], "b".repeat(64));
  expect(a[0].id).not.toBe(b[0].id);
  expect(a[0].followUps[0].id).not.toBe(b[0].followUps[0].id);
  expect([a[0].id, ...a[0].followUps.map((f) => f.id)].every((id) => id.length <= 100)).toBe(true);
  expect(question.id).toBe("model-id");
});
