import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type SessionUser = {
  userId: string | null;
  email: string | null;
  name: string;
  initials: string;
  signOut: () => Promise<void>;
};

function toInitials(label: string): string {
  const parts = label.trim().split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? "");
  return (letters.join("") || "AX").toUpperCase();
}

/**
 * Lê a sessão atual do Lovable Cloud e mantém o estado sincronizado.
 * Expõe também um logout que limpa o cache antes de redirecionar.
 */
export function useSessionUser(): SessionUser {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const apply = (user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      if (!active) return;
      setUserId(user?.id ?? null);
      setEmail(user?.email ?? null);
      const meta = user?.user_metadata;
      const raw = meta && typeof meta["display_name"] === "string" ? (meta["display_name"] as string) : null;
      const full = meta && typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : null;
      setDisplayName(raw ?? full);
    };

    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const name = displayName ?? email ?? "Minha conta";

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return { userId, email, name, initials: toInitials(name), signOut };
}
