import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { AIError } from "@/lib/ai/usage";
export function getAIModel() {
  const provider = process.env.AI_PROVIDER || "groq";
  const model = process.env.AI_MODEL;
  if (!model) throw new AIError("AI 모델 설정이 필요합니다. 관리자에게 문의해 주세요.");
  if (provider === "groq") {
    if (!process.env.GROQ_API_KEY)
      throw new AIError("Groq 연결 설정이 필요합니다. 관리자에게 문의해 주세요.");
    return createGroq({ apiKey: process.env.GROQ_API_KEY })(model);
  }
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY)
      throw new AIError("AI 제공자 설정이 필요합니다. 관리자에게 문의해 주세요.");
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(model);
  }
  throw new AIError("지원하지 않는 AI 제공자 설정입니다.");
}
