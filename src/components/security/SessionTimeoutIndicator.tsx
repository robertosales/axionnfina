import { Clock, ShieldCheck } from "lucide-react";

import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
