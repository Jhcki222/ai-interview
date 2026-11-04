import { it, expect } from "vitest";
import { nvidiaStructuredBody } from "../lib/ai/provider-transport";
it("disables NVIDIA thinking for constrained JSON without changing prompts or model", () => {
  const input = {
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    messages: [{ role: "user", content: "합성 질문" }],
    response_format: { type: "json_object" },
  };
  expect(JSON.parse(nvidiaStructuredBody(JSON.stringify(input)))).toEqual({
    ...input,
    chat_template_kwargs: { enable_thinking: false },
  });
});
it("leaves unconstrained text requests intact", () => {
  const body = JSON.stringify({ model: "example", messages: [] });
  expect(nvidiaStructuredBody(body)).toBe(body);
});
