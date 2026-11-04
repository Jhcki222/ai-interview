import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/validation";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const client = await createClient();
  if (client && code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(new URL(safeRedirect(url.searchParams.get("next")), url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
}
