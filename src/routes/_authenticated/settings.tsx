import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { AccountCard } from "@/components/finance/AccountCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { accounts } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Configurações — Axionn Finance" },
      {
        name: "description",
        content:
          "Gerencie integrações Open Finance, escopos de consentimento e preferências de privacidade (LGPD).",
      },
      { property: "og:title", content: "Configurações — Axionn Finance" },
      {
        property: "og:description",
        content: "Integrações bancárias, consentimentos granulares e controles de privacidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const scopes = [
  { id: "accounts", label: "Contas e saldos", default: true },
  { id: "transactions", label: "Transações", default: true },
  { id: "credit_cards", label: "Cartões de crédito", default: true },
  { id: "investments", label: "Investimentos", default: false },
  { id: "pix", label: "Chaves Pix", default: false },
  { id: "payment_initiation", label: "Iniciação de pagamento", default: false },
] as const;

function SettingsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(scopes.map((s) => [s.id, s.default])),
  );

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Integrações Open Finance, consentimentos e privacidade
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Instituições conectadas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </div>

        <Card className="h-fit rounded-xl border-border/60 p-5 shadow-elevation-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">Escopos do consentimento</h2>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Cada escopo é solicitado individualmente ao banco e pode ser revogado a qualquer momento.
          </p>

          <ul className="mt-4 space-y-3">
            {scopes.map((scope) => (
              <li key={scope.id} className="flex items-center justify-between gap-3">
                <Label htmlFor={`scope-${scope.id}`} className="text-sm font-normal">
                  {scope.label}
                </Label>
                <Switch
                  id={`scope-${scope.id}`}
                  checked={enabled[scope.id] ?? false}
                  onCheckedChange={(value) =>
                    setEnabled((prev) => ({ ...prev, [scope.id]: value }))
                  }
                />
              </li>
            ))}
          </ul>

          <Separator className="my-5" />

          <h3 className="text-sm font-semibold">Privacidade (LGPD)</h3>
          <Badge variant="outline" className="mt-2 rounded-full text-[10px]">
            Tokens armazenados criptografados
          </Badge>
          <Button variant="outline" size="sm" className="mt-3 w-full text-danger">
            Excluir meus dados
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
