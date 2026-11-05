export function isSocialOnly(providers: readonly string[] = []): boolean {
  return (
    providers.some((provider) => provider === "google" || provider === "github") &&
    !providers.includes("email")
  );
}
