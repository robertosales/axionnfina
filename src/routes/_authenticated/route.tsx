import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (!error && data.user) return { user: data.user };

      if (error) console.warn("[Auth] Stored session is no longer valid.", error.message);
    } catch (error) {
      // Network/storage errors must not escape into the application's root
      // error boundary. Clear the local session to prevent an auth redirect loop.
      console.error("[Auth] Could not validate the current session.", error);
    }

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.warn("[Auth] Could not clear the local session.", error);
    }

    throw redirect({ to: "/auth", replace: true });
  },
  component: () => <Outlet />,
});
