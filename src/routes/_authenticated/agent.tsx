import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Loader2, Send, Sparkles, User, Wrench } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useBudgets, useGoals, useInsights } from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agent")({
  head: () => ({
    meta: [
      { title: "Agente IA — Axionn Finance" },
      {
        name: "description",
        content:
          "Converse com o agente financeiro Axionn: consulte gastos, projete fluxo de caixa e acompanhe metas com dados reais.",
      },
      { property: "og:title", content: "Agente IA — Axionn Finance" },
      {
        property: "og:description",
        content: "Assistente multi-agente com ferramentas conectadas ao seu histórico financeiro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentPage,
});

const suggestions = [
  "Quanto gastei com transporte este mês?",
  "Como está meu orçamento agora?",
  "Projete meu fluxo de caixa dos próximos 3 meses",
];

const toolLabels: Record<string, string> = {
  "tool-resumo_financeiro": "Consultando resumo financeiro",
  "tool-buscar_transacoes": "Buscando transações",
  "tool-status_orcamento": "Analisando orçamento",
  "tool-projecao_fluxo_caixa": "Projetando fluxo de caixa",
  "tool-metas": "Consultando metas",
};

function AgentPage() {
  const [draft, setDraft] = useState("");
  const { data: accounts = [] } = useAccounts();
  const { items: budgetItems } = useBudgets();
  const { data: goals = [] } = useGoals();
  const { data: insights = [] } = useInsights();

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  });

  const busy = status === "submitted" || status === "streaming";
  const netWorth = accounts.reduce((sum, account) => sum + account.balance, 0);
  const liquidity = accounts
    .filter((account) => account.type !== "credit")
    .reduce((sum, account) => sum + account.balance, 0);

  const send = (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    void sendMessage({ text: content });
    setDraft("");
  };

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Agente IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Planner + especialistas com acesso em tempo real ao seu histórico financeiro
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex min-h-[60vh] flex-col rounded-xl border-border/60 p-0 shadow-elevation-1">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                  <Bot className="size-4 text-primary" aria-hidden />
                </span>
                <p className="max-w-prose rounded-2xl bg-muted/60 px-4 py-2.5 text-sm leading-relaxed">
                  Olá! Sou o Axionn. Posso consultar seus gastos, orçamento, metas e projetar seu
                  fluxo de caixa usando os dados reais da sua conta. O que você quer saber?
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex gap-3", message.role === "user" && "flex-row-reverse text-right")}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                  {message.role === "assistant" ? (
                    <Bot className="size-4 text-primary" aria-hidden />
                  ) : (
                    <User className="size-4" aria-hidden />
                  )}
                </span>
                <div className="max-w-prose space-y-2">
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <p
                          key={index}
                          className={cn(
                            "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                            message.role === "assistant"
                              ? "bg-muted/60"
                              : "bg-primary text-primary-foreground",
                          )}
                        >
                          {part.text}
                        </p>
                      );
                    }
                    if (part.type.startsWith("tool-")) {
                      return (
                        <p
                          key={index}
                          className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground"
                        >
                          <Wrench className="size-3" aria-hidden />
                          {toolLabels[part.type] ?? part.type.replace("tool-", "")}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}

            {busy && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden /> Analisando seus dados…
              </p>
            )}

            {error && (
              <p className="rounded-lg border border-danger/40 px-3 py-2 text-xs text-danger">
                Não consegui responder agora: {error.message}
              </p>
            )}
          </div>

          <div className="border-t border-border/60 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="focus-ring rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Pergunte sobre gastos, metas, impostos…"
                aria-label="Mensagem para o agente"
              />
              <Button type="submit" size="icon" aria-label="Enviar" disabled={busy}>
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </Card>

        <Card className="h-fit rounded-xl border-border/60 p-5 shadow-elevation-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">Contexto do agente</h2>
          </div>

          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Patrimônio</dt>
              <dd className="numeric font-medium">{formatBRL(netWorth)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Liquidez</dt>
              <dd className="numeric font-medium">{formatBRL(liquidity)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Contas conectadas</dt>
              <dd className="numeric font-medium">{accounts.length}</dd>
            </div>
          </dl>

          <Separator className="my-4" />

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Metas ativas
          </h3>
          <ul className="mt-2 space-y-1 text-xs">
            {goals.length === 0 && <li className="text-muted-foreground">Nenhuma meta cadastrada</li>}
            {goals.map((goal) => (
              <li key={goal.id} className="flex justify-between gap-2">
                <span className="truncate">{goal.name}</span>
                <span className="numeric text-muted-foreground">
                  {goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Alertas de orçamento
          </h3>
          <ul className="mt-2 space-y-1 text-xs">
            {budgetItems
              .filter((item) => item.planned > 0 && item.spent / item.planned >= 0.8)
              .map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.category}</span>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {Math.round((item.spent / item.planned) * 100)}%
                  </Badge>
                </li>
              ))}
          </ul>

          <Separator className="my-4" />

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Insights recentes
          </h3>
          <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
            {insights.slice(0, 4).map((insight) => (
              <li key={insight.id}>{insight.title}</li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
