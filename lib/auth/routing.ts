import { safeRedirect } from "./validation";
export function unauthenticatedDestination({
  configured,
  authenticated,
  pathname,
  search,
}: {
  configured: boolean;
  authenticated: boolean;
  pathname: string;
  search: string;
}): string | null {
  if (!configured || authenticated) return null;
  if (
    pathname !== "/my" &&
    !pathname.startsWith("/my/") &&
    pathname !== "/settings" &&
    !pathname.startsWith("/settings/")
  )
    return null;
  const next = safeRedirect(`${pathname}${search}`);
  return `/login?${new URLSearchParams({ next }).toString()}`;
}
