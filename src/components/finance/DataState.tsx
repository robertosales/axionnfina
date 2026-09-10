import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function DataState({
  loading,
  error,
  empty,
  children,
  onRetry,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  children: ReactNode;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <p role="status" className="py-8 text-sm text-muted-foreground">
        Carregando dados…
      </p>
    );
  if (error)
    return (
      <div role="alert" className="py-6 text-sm">
        <p>
          {typeof error === "object" && error !== null && "code" in error && error.code === "42501"
            ? "Você não tem permissão para consultar estes dados."
            : "Não foi possível carregar estes dados."}
        </p>
        {onRetry && (
          <Button variant="outline" className="mt-3" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  if (empty)
    return (
      <p className="py-8 text-sm text-muted-foreground">Ainda não há dados para este período.</p>
    );
  return children;
}
