/**
 * useRealtime — Hook genérico para subscriptions Supabase Realtime.
 * Escuta mudanças em uma tabela e invalida queries do React Query.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

type UseRealtimeOptions = {
  /** Nome da tabela para escutar. */
  table: string;
  /** Query keys para invalidar quando houver mudanças. */
  queryKeys?: string[][];
  /** Schema do banco (padrão: 'public'). */
  schema?: string;
  /** Filtro de eventos: INSERT, UPDATE, DELETE, * (padrão: *). */
  event?: "INSERT" | "UPDATE" | | "DELETE" | "*";
  /** Habilitar/desabilitar a subscription. */
  enabled?: boolean;
};

export function useRealtime({
  table,
  queryKeys = [],
  schema = "public",
  event = "*",
  enabled = true,
}: UseRealtimeOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        "postgres_changes",
        {
          event,
          schema,
          table,
        },
        () => {
          // Invalida todas as query keys fornecidas
          for (const key of queryKeys) {
            void queryClient.invalidateQueries({ queryKey: key });
          }
          // Se nenhuma query key específica, invalida tudo
          if (queryKeys.length === 0) {
            void queryClient.invalidateQueries();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, schema, event, enabled, queryClient, queryKeys]);
}

/**
 * useRealtimeAccounts — Escuta mudanças na tabela accounts.
 */
export function useRealtimeAccounts() {
  useRealtime({
    table: "accounts",
    queryKeys: [["accounts"], ["net-worth"]],
  });
}

/**
 * useRealtimeTransactions — Escuta mudanças na tabela transactions.
 */
export function useRealtimeTransactions() {
  useRealtime({
    table: "transactions",
    queryKeys: [["transactions"], ["budgets"], ["payables"]],
  });
}

/**
 * useRealtimeAgentMessages — Escuta novas mensagens do agente.
 */
export function useRealtimeAgentMessages(conversationId?: string) {
  useRealtime({
    table: "agent_messages",
    queryKeys: conversationId ? [["agent-messages", conversationId]] : [],
    event: "INSERT",
  });
}
