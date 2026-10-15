import { FinancialForm } from "@/components/finance/FinancialForm";
import { EmptyState } from "@/components/finance/EmptyState";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { ValidatedInput } from "@/components/finance/ValidatedInput";
import { PrivacySettings } from "@/components/finance/privacy-settings";
import { parseFinancialInput } from "@/lib/financial-input";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Link2, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AccountCard } from "@/components/finance/AccountCard";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  useAccounts,
  useCreateOpenFinanceConsent,
  useOpenFinanceInstitutions,
  useUpsertAccount,
} from "@/lib/finance-data";
import type { AccountType } from "@/shared/finance-types";

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
  const { data: accounts = [], isLoading } = useAccounts();
  const upsertAccount = useUpsertAccount();
  const institutionsQuery = useOpenFinanceInstitutions();
  const createConsent = useCreateOpenFinanceConsent();
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("CHECKING");
  const [balance, setBalance] = useState("0");
  const [branch, setBranch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(scopes.map((s) => [s.id, s.default])),
  );
  const [institutionId, setInstitutionId] = useState("");
  const connectOpenFinance = () => {
    if (!institutionId) {
      toast.error("Selecione uma instituição participante");
      return;
    }
    createConsent.mutate(
      {
        institutionId,
        scopes: Object.entries(enabled)
          .filter(([, value]) => value)
          .map(([key]) => key),
      },
      {
        onSuccess: () => toast.success("Consentimento autorizado e conexão registrada"),
        onError: (error) =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  const saveAccount = () => {
    const amount = parseFinancialInput(balance);
    if (!institution.trim() || !name.trim() || !Number.isFinite(amount)) {
      toast.error("Informe instituição, nome e saldo válidos");
      return;
    }
    upsertAccount.mutate(
      {
        institution: institution.trim(),
        name: name.trim(),
        type,
        balance: amount,
        branch,
        accountNumber,
      },
      {
        onSuccess: () => {
          toast.success("Conta cadastrada com sucesso");
          setOpen(false);
          setInstitution("");
          setName("");
          setBranch("");
          setAccountNumber("");
          setType("CHECKING");
          setBalance("0");
        },
        onError: (error) =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Integrações Open Finance, consentimentos e privacidade
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Minhas contas</h2>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Nova conta
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando contas…</p>}
            {!isLoading && accounts.length === 0 && (
              <EmptyState
                title="Nenhuma conta cadastrada"
                className="sm:col-span-2"
              />
            )}
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
            Cada escopo é solicitado individualmente ao banco e pode ser revogado a qualquer
            momento.
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

          <div className="mt-5 space-y-3 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <Link2 className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">Conectar instituição</h3>
            </div>
            <Select value={institutionId} onValueChange={setInstitutionId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    institutionsQuery.isLoading ? "Carregando instituições…" : "Escolha seu banco"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(institutionsQuery.data ?? []).map((institution) => (
                  <SelectItem key={institution.id} value={institution.id}>
                    {institution.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              onClick={connectOpenFinance}
              disabled={createConsent.isPending || institutionsQuery.isLoading}
            >
              <CheckCircle2 className="size-4" />{" "}
              {createConsent.isPending ? "Conectando…" : "Autorizar conexão"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Ambiente de teste: o consentimento é registrado com segurança para validar o fluxo
              completo.
            </p>
          </div>

          <Separator className="my-5" />

          <PrivacySettings />
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto">
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>Cadastrar nova conta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="institution">Instituição</Label>
                <ValidatedInput
                  id="institution"
                  value={institution}
                  onChange={(event) => setInstitution(event.target.value)}
                  placeholder="Ex.: Nubank"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-name">Nome da conta</Label>
                <ValidatedInput
                  required
                  id="account-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: Conta corrente"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(value) => setType(value as AccountType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHECKING">Conta corrente</SelectItem>
                    <SelectItem value="SAVINGS">Poupança</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                    <SelectItem value="INVESTMENT">Investimentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === "CHECKING" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="branch">Agência</Label>
                      <ValidatedInput
                        id="branch"
                        value={branch}
                        onChange={(event) => setBranch(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="account-number">Número da conta</Label>
                      <ValidatedInput
                        id="account-number"
                        value={accountNumber}
                        onChange={(event) => setAccountNumber(event.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="account-balance">Saldo atual</Label>
                <MoneyInput
                  id="account-balance"
                  inputMode="decimal"
                  value={balance}
                  onChange={(event) => setBalance(event.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                data-financial-submit
                type="button"
                onClick={saveAccount}
                disabled={upsertAccount.isPending}
              >
                {upsertAccount.isPending ? "Salvando…" : "Salvar conta"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
