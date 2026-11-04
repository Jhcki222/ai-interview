import { requestSchema } from "./schemas";
type PriorTurn = { question: string; answer: string };
function excerpt(value: string, limit: number) {
  if (value.length <= limit) return value;
  const marker = " […] ";
  const head = Math.floor((limit - marker.length) / 2);
  return value.slice(0, head) + marker + value.slice(-(limit - marker.length - head));
}
export function buildConversationRequest(
  action: "evaluate" | "followup",
  question: string,
  answer: string,
  previous: PriorTurn[] = [],
) {
  const history = previous.slice(-3).map((turn) => ({
    question: excerpt(turn.question, 400),
    answer: excerpt(turn.answer, 500),
  }));
  const body = { action, question, answer, history };
  requestSchema.parse(body);
  return body;
}
