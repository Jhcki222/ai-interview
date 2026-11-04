import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/supabase/server";
export class AIError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
const hash = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value).digest("hex");
export async function consumeUsage(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const secret = process.env.AI_COOKIE_SECRET;
  if (!url || !service || !secret || secret.length < 32)
    throw new AIError("AI 사용량 제한 서비스 설정이 필요합니다.");
  const user = await getUser();
  const identities: string[] = [];
  if (user) identities.push(`user:${user.id}`);
  else {
    const jar = await cookies();
    const raw = jar.get("interview_guest")?.value || "";
    const [id, signature] = raw.split(".");
    const valid =
      id &&
      /^[\da-f-]{36}$/.test(id) &&
      signature &&
      /^[a-f0-9]{64}$/.test(signature) &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(hash(id, secret)));
    const guest = valid ? id : randomUUID();
    if (!valid)
      jar.set("interview_guest", `${guest}.${hash(guest, secret)}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 86400 * 30,
      });
    identities.push(`guest:${guest}`);
  }
  // Vercel overwrites this header at its trusted ingress. Never trust generic forwarded headers.
  if (process.env.VERCEL === "1") {
    const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (!ip && !user) throw new AIError("요청 식별 정보를 확인할 수 없습니다.");
    if (ip) identities.push(`ip:${hash(ip, secret)}`);
  }
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc("consume_ai_usage", {
    p_subjects: identities,
    p_limit: user ? 80 : 20,
  });
  if (error) throw new AIError("AI 사용량을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  if (data !== true)
    throw new AIError("오늘의 AI 사용 한도에 도달했습니다. 내일 다시 이용해 주세요.", 429);
}
