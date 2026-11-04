import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* Server Components cannot refresh cookies; proxy handles it. */
        }
      },
    },
  });
}
export async function getUser() {
  try {
    const client = await createClient();
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
}
