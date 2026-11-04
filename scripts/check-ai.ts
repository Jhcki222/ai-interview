import { createGroq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";
// Deliberately sends only synthetic test content. Never print keys or provider request headers.
if (!process.env.GROQ_API_KEY || !process.env.AI_MODEL) {
  console.error("Groq API key/model environment is missing.");
  process.exitCode = 1;
} else {
  try {
    const result = await generateText({
      model: createGroq({ apiKey: process.env.GROQ_API_KEY })(process.env.AI_MODEL),
      output: Output.object({ schema: z.object({ ok: z.boolean() }) }),
      prompt: 'Return {"ok":true} as the structured connectivity check. No other content.',
      maxOutputTokens: 512,
      abortSignal: AbortSignal.timeout(30000),
      maxRetries: 0,
    });
    console.log(
      JSON.stringify({
        provider: "groq",
        model: process.env.AI_MODEL,
        structuredOutputValidated: result.output.ok === true,
        totalTokens: result.totalUsage.totalTokens,
      }),
    );
  } catch (error) {
    const status =
      typeof error === "object" && error && "statusCode" in error ? error.statusCode : undefined;
    console.error(
      JSON.stringify({
        provider: "groq",
        success: false,
        status,
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    process.exitCode = 1;
  }
}
