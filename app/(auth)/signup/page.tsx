import { AuthForm } from "@/components/auth/auth-form";
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return <AuthForm mode="signup" next={(await searchParams).next} />;
}
