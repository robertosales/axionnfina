import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CircleAlert, Inbox, LoaderCircle } from "lucide-react";

export function DataState({
  loading,
  error,
  empty,
  children,
  onRetry,
  suppressEmpty,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  children: ReactNode;
  onRetry?: () => void;
  /** When true, renders nothing instead of the default empty message. */
  suppressEmpty?: boolean;
}) {
  if (loading)
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-3 px-4 py-10 text-sm text-muted-foreground"
      >
        <LoaderCircle className="size-5 shrink-0 motion-safe:animate-spin" aria-hidden />
        Carregando dados…
      </p>
    );
  if (error)
    return (
      <div
        role="alert"
        className="flex flex-col items-center rounded-xl bg-danger/5 px-4 py-8 text-center text-sm"
      >
        <CircleAlert className="mb-3 size-6 text-danger" aria-hidden />
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
  if (empty) {
    if (suppressEmpty) return null;
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-muted-foreground">
        <Inbox className="size-8" aria-hidden />
        <p>Ainda não há dados para este período.</p>
      </div>
    );
  }
  return children;
}
