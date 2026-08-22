import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { agentInsights, budgetItems, goals, kpis } from "@/lib/mock-data";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "Agente IA — Axionn Finance" },
      {
        name: "description",
        content:
          "Converse com o agente financeiro Axionn: consulte gastos, projete fluxo de caixa e agende pagamentos.",
      },
      { property: "og:title", content: "Agente IA — Axionn Finance" },
      {
        property: "og:description",
        content: "Assistente multi-agente para consultas, projeções e ações financeiras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentPage,
});

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const initialMessages: Message[] = [
  {
    id: "m1",
    role: "assistant",
    content:
      "Olá, Roberto. Já analisei agosto: sua taxa de poupança está em 38,5% e o orçamento de Transporte estourou em R$ 62. Como posso ajudar?",
  },
];

const suggestions = [
  "Quanto gastei com Uber este mês?",
  "Qual meu fluxo de caixa do próximo mês?",
  "Agende Pix de 500 para a conta Inter amanhã",
];

function AgentPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");

  const send = (text: string) => {
    const content = text.trim();
    if (!content) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${prev.length}`, role: "user", content },
      {
        id: `a-${prev.length}`,
        role: "assistant",
        content:
          "Anotado. O orquestrador multi-agente (Planner + Specialists + Memory) será conectado ao backend na próxima fase — por enquanto estou respondendo com o contexto financeiro carregado no painel.",
      },
    ]);
    setDraft("");
  };

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Agente IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Planner + especialistas com memória semântica do seu histórico financeiro
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex min-h-[60vh] flex-col rounded-xl border-border/60 p-0 shadow-elevation-1">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" && "flex-row-reverse text-right",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                  {message.role === "assistant" ? (
                    <Bot className="size-4 text-primary" aria-hidden />
                  ) : (
                    <User className="size-4" aria-hidden />
                  )}
                </span>
                <p
                  className={cn(
                    "max-w-prose rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    message.role === "assistant"
                      ? "bg-muted/60"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {message.content}
                </p>
              </div>
            ))}
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
              <Button type="submit" size="icon" aria-label="Enviar">
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
              <dd className="numeric font-medium">{formatBRL(kpis.netWorth.value)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Liquidez</dt>
              <dd className="numeric font-medium">{formatBRL(kpis.liquidity.value)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Taxa de poupança</dt>
              <dd className="numeric font-medium">{kpis.savingsRate.value}%</dd>
            </div>
          </dl>

          <Separator className="my-4" />

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Metas ativas
          </h3>
          <ul className="mt-2 space-y-1 text-xs">
            {goals.map((goal) => (
              <li key={goal.id} className="flex justify-between gap-2">
                <span className="truncate">{goal.name}</span>
                <span className="numeric text-muted-foreground">
                  {Math.round((goal.current / goal.target) * 100)}%
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
              .filter((item) => item.spent / item.planned >= 0.8)
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
            Memórias recentes
          </h3>
          <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
            {agentInsights.map((insight) => (
              <li key={insight.id}>{insight.title}</li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
