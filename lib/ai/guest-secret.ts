import { createHmac } from "node:crypto";
export function guestSigningSecret(explicit: string | undefined, service: string): string {
  if (explicit) {
    if (explicit.length < 32) throw new Error("Invalid signing secret");
    return explicit;
  }
  if (service.length < 32) throw new Error("Invalid service secret");
  return createHmac("sha256", service).update("interview-ai-guest-cookie-v1").digest("hex");
}
