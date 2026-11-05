import { AuthForm } from "@/components/auth/auth-form";
import { getUser } from "@/lib/supabase/server";
import { isSocialOnly } from "@/lib/auth/login-method";
import { redirect } from "next/navigation";
export default async function Update() {
  const user = await getUser();
  if (!user) redirect("/reset-password");
  const providers = user.app_metadata?.providers ?? [user.app_metadata?.provider];
  if (
    isSocialOnly(providers.filter((provider): provider is string => typeof provider === "string"))
  )
    redirect("/settings");
  return <AuthForm mode="update" />;
}
