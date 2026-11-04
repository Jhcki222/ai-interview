import type { Evaluation } from "./schemas";
export type SummaryTurnInput = { question: string; answer: string; evaluation: Evaluation };
// Keep the beginning and conclusion; do not silently pretend the excerpt is the full answer.
function excerpt(value: string, limit: number) {
  if (value.length <= limit) return value;
  const marker = " […] ";
  const half = Math.floor((limit - marker.length) / 2);
  return value.slice(0, half) + marker + value.slice(-(limit - marker.length - half));
}
export function buildSummaryRequest(turns: SummaryTurnInput[]) {
  if (turns.length < 1 || turns.length > 45) throw new Error("종합 평가 기록 수를 확인해 주세요.");
  const build = (scale: number) => ({
    action: "summary" as const,
    excerpted: true as const,
    turns: turns.map((turn) => ({
      question: excerpt(turn.question, Math.floor(120 * scale)),
      answer: excerpt(turn.answer, Math.floor(360 * scale)),
      evaluation: {
        score: turn.evaluation.score,
        dimensions: turn.evaluation.dimensions.map((d) => ({
          ...d,
          evidence: excerpt(d.evidence, Math.floor(80 * scale)),
        })),
        strengths: turn.evaluation.strengths
          .slice(0, 1)
          .map((s) => excerpt(s, Math.floor(80 * scale))),
        improvements: turn.evaluation.improvements
          .slice(0, 1)
          .map((s) => excerpt(s, Math.floor(80 * scale))),
      },
    })),
  });
  // JSON escaping and Unicode byte size vary; preserve all turns/dimensions while reducing excerpts.
  let scale = 1;
  let body = build(scale);
  while (new TextEncoder().encode(JSON.stringify(body)).length >= 180000) {
    scale *= 0.75;
    body = build(scale);
    if (scale < 0.1) throw new Error("종합 평가 요청이 너무 큽니다.");
  }
  return body;
}
