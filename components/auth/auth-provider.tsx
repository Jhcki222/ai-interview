"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { readInitialAuthUser } from "@/lib/auth/session";
import { emailToUsername } from "@/lib/auth/forms";

export type AuthUser = { id: string; email?: string; username?: string; nickname?: string };
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
      u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null,
    ) => {
      if (!active) return;
      setUser(
        u
          ? {
              id: u.id,
              email: u.email,
              username:
                typeof u.user_metadata?.username === "string"
                  ? u.user_metadata.username
                  : emailToUsername(u.email),
              nickname:
                typeof u.user_metadata?.nickname === "string"
                  ? u.user_metadata.nickname
                  : undefined,
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
