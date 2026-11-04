import { AuthForm } from "@/components/auth/auth-form";
import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export default async function Update() {
  if (!(await getUser())) redirect("/reset-password");
  return <AuthForm mode="update" />;
}
