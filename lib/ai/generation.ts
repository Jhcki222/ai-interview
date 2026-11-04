import type { z } from "zod";
interface Strategy<T> {
  provider?: string;
  schema: z.ZodType<T>;
  complete: () => Promise<unknown>;
  stream: () => { partialOutputStream: AsyncIterable<unknown>; output: PromiseLike<unknown> };
  onPartial: (value: unknown) => void;
}
// Groq structured outputs do not support upstream streaming. Never fabricate partials.
export async function generateForProvider<T>({
  provider = "groq",
  schema,
  complete,
  stream,
  onPartial,
}: Strategy<T>): Promise<T> {
  if (provider === "groq") return schema.parse(await complete());
  if (provider !== "openai") throw new Error("Unsupported provider");
  const result = stream();
  for await (const partial of result.partialOutputStream) onPartial(partial);
  return schema.parse(await result.output);
}
