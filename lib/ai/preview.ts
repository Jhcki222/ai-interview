export function previewText(action: string, partial: unknown): string {
  if (!partial || typeof partial !== "object") return "";
  const value = partial as Record<string, unknown>;
  if (action === "generate" && Array.isArray(value.questions)) {
    const texts = value.questions.flatMap((q, i) =>
      q && typeof q === "object" && typeof q.question === "string"
        ? [`${i + 1}. ${q.question}`]
        : [],
    );
    return texts.join("\n\n").slice(-3000);
  }
  const field =
    action === "evaluate" ? "revisedAnswer" : action === "followup" ? "question" : "summary";
  return typeof value[field] === "string" ? value[field].slice(0, 3000) : "";
}
