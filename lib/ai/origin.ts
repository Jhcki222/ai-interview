export function isSameAIOrigin(request: Request, vercel = false): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const url = new URL(request.url);
  const allowed = new Set([url.origin]);
  const host = vercel
    ? request.headers.get("x-forwarded-host") || request.headers.get("host")
    : request.headers.get("host");
  if (host && /^[a-zA-Z0-9.\-:\[\]]+$/.test(host)) {
    const proto =
      vercel && request.headers.get("x-forwarded-proto") === "https" ? "https:" : url.protocol;
    try {
      allowed.add(new URL(`${proto}//${host}`).origin);
    } catch {
      /* Invalid host is never accepted. */
    }
  }
  return allowed.has(origin);
}
