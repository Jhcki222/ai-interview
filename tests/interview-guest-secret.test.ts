import { it, expect } from "vitest";
import { guestSigningSecret } from "../lib/ai/guest-secret";
it("derives a stable domain-separated key without returning the service secret", () => {
  const service = "service-secret-".repeat(4);
  const result = guestSigningSecret(undefined, service);
  expect(result).toHaveLength(64);
  expect(result).toBe(guestSigningSecret(undefined, service));
  expect(result).not.toContain(service);
  expect(result).not.toBe(guestSigningSecret(undefined, "another-secret-".repeat(4)));
});
it("prefers a configured strong cookie secret and rejects weak explicit secrets", () => {
  const configured = "configured-cookie-secret-".repeat(2);
  expect(guestSigningSecret(configured, "service-secret-".repeat(4))).toBe(configured);
  expect(() => guestSigningSecret("weak", "service-secret-".repeat(4))).toThrow();
});
