import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./lib/supabase/config";
import { unauthenticatedDestination } from "./lib/auth/routing";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (!config) return response;
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  let authenticated = false;
  try {
    const { data, error } = await client.auth.getUser();
    authenticated = !error && !!data.user;
  } catch {
    /* Treat a failed verification as unauthenticated without exposing provider errors. */
  }
  const destination = unauthenticatedDestination({
    configured: true,
    authenticated,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });
  if (destination) {
    const redirect = NextResponse.redirect(new URL(destination, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
