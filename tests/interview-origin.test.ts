import { it, expect } from "vitest";
import { isSameAIOrigin } from "../lib/ai/origin";
it("accepts the actual incoming host when Next normalizes local loopback names", () => {
  expect(
    isSameAIOrigin(
      new Request("http://localhost:3000/api/ai", {
        headers: { Origin: "http://127.0.0.1:3000", Host: "127.0.0.1:3000" },
      }),
    ),
  ).toBe(true);
});
it("rejects foreign origins and only trusts forwarded host on Vercel", () => {
  const request = new Request("http://localhost/api/ai", {
    headers: {
      Origin: "https://example.com",
      Host: "localhost",
      "x-forwarded-host": "example.com",
      "x-forwarded-proto": "https",
    },
  });
  expect(isSameAIOrigin(request)).toBe(false);
  expect(isSameAIOrigin(request, true)).toBe(true);
  expect(
    isSameAIOrigin(
      new Request("https://app.example/api/ai", {
        headers: { Origin: "https://evil.example", Host: "app.example" },
      }),
      true,
    ),
  ).toBe(false);
});
