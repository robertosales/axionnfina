import { useState, useEffect, useCallback } from "react";
import { Clock, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-risk";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Hook para gerenciar sessão com timeout automático.
 * Monitora a atividade do usuário e expira sessões inativas.
 */
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

  // Monitorar atividade do usuário
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

  toast.info("Sessão expirada por inatividade");
}

/**
 * Componente de indicador de sessão ativa com timeout.
 * Exibe o tempo restante antes da expiração.
 */
export function SessionTimeoutIndicator() {
  const { remainingMs, isExpired, resetActivity, formatRemaining } = useSessionTimeout();

  const isWarning = remainingMs < 5 * 60 * 1000 && remainingMs > 0;
  const isCritical = remainingMs < 1 * 60 * 1000;

  if (isExpired) {
    return (
      <Card className="p-4 border-destructive">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Sessão expirada</p>
            <p className="text-xs text-muted-foreground">Por inatividade. Faça login novamente.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className={`size-5 ${isCritical ? "text-destructive" : isWarning ? "text-orange-500" : "text-chart-2"}`} />
          <div>
            <p className="text-sm font-medium">Sessão ativa</p>
            <p className={`text-xs ${isCritical ? "text-destructive" : "text-muted-foreground"}`}>
              Expira em {formatRemaining()}
            </p>
          </div>
        </div>
        <Badge variant={isCritical ? "destructive" : isWarning ? "outline" : "secondary"}>
          {isCritical ? "Crítico" : isWarning ? "Aviso" : "Seguro"}
        </Badge>
      </div>

      {isWarning && (
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={resetActivity}>
          <ShieldCheck className="mr-2 size-4" />
          Manter sessão ativa
        </Button>
      )}
    </Card>
  );
}
