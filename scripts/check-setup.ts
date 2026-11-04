import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const privateKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const cookieSecret = process.env.AI_COOKIE_SECRET;
const status = {
  supabaseUrl: !!url,
  supabasePublicKey: !!publicKey,
  supabaseServerKey: !!privateKey,
  guestSigningSecret: !!cookieSecret && cookieSecret.length >= 32,
  aiProvider: process.env.AI_PROVIDER || "groq",
  aiKey: !!(process.env.AI_PROVIDER === "openai"
    ? process.env.OPENAI_API_KEY
    : process.env.GROQ_API_KEY),
  aiModel: !!process.env.AI_MODEL,
};
console.log(JSON.stringify(status, null, 2));
if (!url || !publicKey || !privateKey) {
  console.log("Supabase configuration is incomplete. No network request was made.");
  process.exitCode = 1;
} else {
  try {
    const publicClient = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serverClient = createClient(url, privateKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Reads only metadata/counts; never lists member records or consumes AI quota.
    const schema = await serverClient
      .from("saved_questions")
      .select("id", { head: true, count: "exact" });
    const rls = await publicClient
      .from("saved_questions")
      .select("id", { head: true, count: "exact" });
    console.log(
      JSON.stringify({
        schemaAvailable: !schema.error,
        anonymousReadDenied: !!rls.error,
        anonymousVisibleRows: rls.count,
      }),
    );
    if (schema.error) process.exitCode = 1;
  } catch {
    console.error("Supabase connectivity check failed. Verify project URL and keys.");
    process.exitCode = 1;
  }
}
