import { AuthForm } from "@/components/auth/auth-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return <AuthForm mode="login" next={(await searchParams).next} />;
}
