"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { readInitialAuthUser } from "@/lib/auth/session";
import { emailToUsername } from "@/lib/auth/forms";

export type AuthUser = {
  id: string;
  email?: string;
  username?: string;
  nickname?: string;
  providers?: string[];
};
type Auth = {
  user: AuthUser | null;
  configured: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};
const Context = createContext<Auth>({
  user: null,
  configured: false,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createClient());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;
    let authEventReceived = false;
    const update = (
      u: {
        id: string;
        email?: string;
        user_metadata?: Record<string, unknown>;
        app_metadata?: Record<string, unknown>;
      } | null,
    ) => {
      if (!active) return;
      setUser(
        u
          ? {
              id: u.id,
              email: u.email,
              providers: Array.isArray(u.app_metadata?.providers)
                ? u.app_metadata.providers.filter((p): p is string => typeof p === "string")
                : typeof u.app_metadata?.provider === "string"
                  ? [u.app_metadata.provider]
                  : [],
              username:
                typeof u.user_metadata?.username === "string"
                  ? u.user_metadata.username
                  : typeof u.user_metadata?.full_name === "string"
                    ? u.user_metadata.full_name
                    : typeof u.user_metadata?.name === "string"
                      ? u.user_metadata.name
                      : emailToUsername(u.email),
              nickname:
                typeof u.user_metadata?.nickname === "string"
                  ? u.user_metadata.nickname
                  : typeof u.user_metadata?.full_name === "string"
                    ? u.user_metadata.full_name
                    : typeof u.user_metadata?.name === "string"
                      ? u.user_metadata.name
                      : u.email?.split("@")[0],
            }
          : null,
      );
      setLoading(false);
    };
    void readInitialAuthUser(() => client.auth.getUser()).then((user) => {
      if (!authEventReceived) update(user);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      update(session?.user ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  return (
    <Context.Provider
      value={{
        user,
        configured: !!client,
        loading,
        signOut: async () => {
          if (client) {
            const { error } = await client.auth.signOut();
            if (error) throw error;
            setUser(null);
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
