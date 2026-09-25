import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  assessLoginRisk,
  logSecurityEvent,
  type RiskLevel,
  type SecurityEventType,
} from "@/lib/security-risk";

export function useSecurityActions() {
  const [isAssessing, setIsAssessing] = useState(false);

  const checkLoginRisk = useCallback(
    async (ipAddress: string | null, userAgent: string | null, deviceId: string | null) => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.user?.id) return null;

        const userId = session.session.user.id as string;
        const risk = await assessLoginRisk(
          userId,
          ipAddress,
          userAgent,
          deviceId,
        );

        if (risk.level === "high" || risk.level === "critical") {
          await logSecurityEvent({
            eventType: "suspicious_activity",
            severity: risk.level,
            ...(ipAddress !== null ? { ipAddress } : {}),
            ...(userAgent !== null ? { userAgent } : {}),
            ...(deviceId !== null ? { deviceId } : {}),
            metadata: { riskScore: risk.score, reasons: risk.reasons },
          });

          toast.warning(
            `Atenção: atividade suspeita detectada (risco: ${risk.level}). ${risk.reasons.join(", ")}`
          );
        }

        return risk;
      } catch {
        return null;
      }
    },
    []
  );

  const logAuthEvent = useCallback(
    async (eventType: SecurityEventType, severity: RiskLevel, metadata?: Record<string, unknown>) => {
      await logSecurityEvent({
        eventType,
        severity,
        ...(metadata ?? {}),
      });
    },
    []
  );

  return {
    checkLoginRisk,
    logAuthEvent,
    isAssessing,
  };
}
