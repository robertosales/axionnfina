import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bot, Coins, LineChart, ShieldCheck } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Axionn Finance — Agente financeiro pessoal" },
      {
        name: "description",
        content:
          "Patrimônio, orçamento, metas e impostos em um só painel, com um agente de IA que analisa suas finanças.",
      },
      { property: "og:title", content: "Axionn Finance — Agente financeiro pessoal" },
      {
        property: "og:description",
        content:
          "Acompanhe patrimônio, orçamento e metas com um agente de IA que explica cada movimento das suas finanças.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: LineChart,
    title: "Visão consolidada",
    body: "Contas, cartões e investimentos reunidos com evolução de patrimônio e fluxo de caixa.",
  },
  {
    icon: Bot,
    title: "Agente multi-agente",
    body: "Um planejador coordena especialistas em orçamento, investimentos e impostos.",
  },
  {
    icon: ShieldCheck,
    title: "Privacidade por padrão",
    body: "Seus dados ficam isolados por usuário, com consentimento granular e trilha de auditoria.",
  },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2.5">
          <span
            className="grid size-9 place-items-center rounded-xl text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Coins className="size-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">Axionn Finance</span>
        </span>
        <Button asChild size="sm">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto w-full max-w-4xl px-6 pb-16 pt-14 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Seu agente financeiro pessoal, sempre a par das suas contas
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground">
          O Axionn conecta suas contas, organiza orçamento e metas e responde em linguagem simples o
          que fazer com o próximo real.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Começar agora</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-xl border border-border bg-card p-6 text-left"
          >
            <feature.icon className="size-5 text-primary" aria-hidden />
            <h2 className="mt-4 text-sm font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
