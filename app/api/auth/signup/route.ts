import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { usernameToEmail, formatSupabasePassword } from "@/lib/auth/forms";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function POST(request: Request) {
  try {
    const { username, password, nickname } = await request.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const config = getSupabaseConfig();
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (config && serviceRoleKey) {
      const adminClient = createClient(config.url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const email = usernameToEmail(username);
      const supabasePassword = formatSupabasePassword(password);

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password: supabasePassword,
        email_confirm: true,
        user_metadata: {
          username: username.trim(),
          nickname: (nickname || username).trim(),
        },
      });

      if (error) {
        const msg = error.message || "";
        if (
          msg.includes("already registered") ||
          msg.includes("User already registered") ||
          (error as any).status === 422
        ) {
          return NextResponse.json(
            { error: "이미 사용 중인 아이디입니다." },
            { status: 409 },
          );
        }
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      return NextResponse.json({ ok: true, user: data.user, autoConfirmed: true });
    }

    return NextResponse.json({ fallback: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
