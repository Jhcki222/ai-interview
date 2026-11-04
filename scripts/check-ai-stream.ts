import { createGroq } from "@ai-sdk/groq";
import { streamText, generateText, Output } from "ai";
import { analysisSchema, generationSchema } from "../lib/ai/schemas";
import { savedQuestionSchema } from "../lib/auth/validation";
const modelName = process.env.AI_MODEL;
if (!process.env.GROQ_API_KEY || !modelName) throw new Error("Provider environment required");
const model = createGroq({ apiKey: process.env.GROQ_API_KEY })(modelName);
try {
  const analysis = streamText({
    model,
    output: Output.object({ schema: analysisSchema }),
    prompt:
      "합성 연결 테스트 문서를 한국어로 분석하세요. 기술: Java, PostgreSQL. 프로젝트: 도서 대출 API. 담당: 검색 API와 인덱스 설계. 성능 수치는 기록하지 않았습니다. 출처가 없는 내용을 만들지 마세요.",
    maxOutputTokens: 2000,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(45000),
  });
  let parts = 0;
  for await (const _ of analysis.partialOutputStream) parts++;
  const checked = analysisSchema.parse(await analysis.output);
  console.log(
    JSON.stringify({
      step: "analysis",
      streamParts: parts,
      validated: true,
      skills: checked.skills.length,
      totalTokens: (await analysis.totalUsage).totalTokens,
    }),
  );
  const generated = await generateText({
    model,
    output: Output.object({ schema: generationSchema }),
    prompt: `합성 테스트 지원자의 분석으로 한국어 기술 면접 질문을 정확히 5개 생성하세요. 각 모범답안은 핵심을 간결히 1~2문장으로 적고 꼬리질문은 각각 답을 포함해 정확히2개 작성하세요. 꼬리질문 modelAnswer는 객체가 아닌 문자열이어야 합니다. 모든 source는 사실에 근거하고 ID는 유일해야 합니다. 분석: ${JSON.stringify(checked)}`,
    maxOutputTokens: 24000,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(90000),
  });
  const result = generationSchema.parse(generated.output);
  for (const question of result.questions) savedQuestionSchema.parse(question);
  console.log(
    JSON.stringify({
      step: "generation",
      mode: "non-streaming-strict",
      validated: true,
      questions: result.questions.length,
      saveSchemaValidated: true,
      totalTokens: generated.totalUsage.totalTokens,
    }),
  );
} catch (error) {
  const status =
    typeof error === "object" && error && "statusCode" in error ? error.statusCode : undefined;
  console.error(
    JSON.stringify({
      success: false,
      status,
      errorType: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  process.exitCode = 1;
}
