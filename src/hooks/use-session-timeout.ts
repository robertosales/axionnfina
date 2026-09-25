import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-risk";

export function useSessionTimeout(timeoutMs = 30 * 60 * 1000) {
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isExpired, setIsExpired] = useState(false);
  const [remainingMs, setRemainingMs] = useState(timeoutMs);

  const resetActivity = useCallback(() => {
    setLastActivity(Date.now());
    setIsExpired(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      const remaining = Math.max(0, timeoutMs - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0 && !isExpired) {
        setIsExpired(true);
        void handleSessionExpiry();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastActivity, timeoutMs, isExpired]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll"];
    const handler = () => resetActivity();

    events.forEach((event) => window.addEventListener(event, handler));
    return () => events.forEach((event) => window.removeEventListener(event, handler));
  }, [resetActivity]);

  return {
    lastActivity,
    remainingMs,
    isExpired,
    resetActivity,
    formatRemaining: () => {
      const minutes = Math.floor(remainingMs / 60_000);
      const seconds = Math.floor((remainingMs % 60_000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },
  };
}

async function handleSessionExpiry() {
  try {
    await logSecurityEvent({
      eventType: "session_revoked",
      severity: "medium",
      metadata: { reason: "session_timeout" },
    });
  } catch {
    // Silently fail
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Silently fail
  }
}
