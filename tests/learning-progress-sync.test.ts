import { it, expect } from "vitest";
import { mergeProgress } from "../lib/learning/progress";
it("preserves completed status when bookmark updates arrive later", () => {
  const completed = mergeProgress(undefined, { status: "COMPLETED" });
  expect(mergeProgress(completed, { bookmarked: true })).toEqual({
    status: "COMPLETED",
    bookmarked: true,
  });
});
it("preserves bookmarks when completion arrives later", () => {
  expect(
    mergeProgress(mergeProgress(undefined, { bookmarked: true }), { status: "COMPLETED" }),
  ).toEqual({ status: "COMPLETED", bookmarked: true });
});
it("supports explicitly returning a question to not started", () => {
  expect(
    mergeProgress({ status: "COMPLETED", bookmarked: true }, { status: "NOT_STARTED" }),
  ).toEqual({ status: "NOT_STARTED", bookmarked: true });
});
