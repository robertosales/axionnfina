import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Shield,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  useAccountConnections,
  useCreateConnection,
} from "@/hooks/use-wallet";
import { useInstitutions, useCreateOpenFinanceConsent } from "@/lib/finance-data";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/wallet/connect")({
  head: () => ({
    meta: [{ title: "Conectar Banco — Axionn Finance" }],
  }),
  component: ConnectPage,
});

function ConnectPage() {
  const { data: institutions = [] } = useInstitutions();
  const { data: connections = [] } = useAccountConnections();
  const createConnection = useCreateConnection();
  const createConsent = useCreateOpenFinanceConsent();

  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async (institutionId: string) => {
    setConnecting(true);
    setSelectedInstitution(institutionId);

    try {
      // 1. Criar consentimento
      const consent = await createConsent.mutateAsync({
        institutionId: institutionId,
        scopes: ["accounts", "transactions", "credit_cards"],
      });

      // 2. Criar conexão
      await createConnection.mutateAsync({
        institutionId: institutionId,
        consent_id: consent?.id,
        status: "pending",
        external_provider: "pluggy",
      });

      toast.success("Conexão iniciada. Em produção, você seria redirecionado ao banco.");
    } catch {
      toast.error("Erro ao iniciar conexão");
    } finally {
      setConnecting(false);
      setSelectedInstitution(null);
    }
  };

  const isConnected = (institutionId: string) =>
    connections.some(
      (c) => c.institution_id === institutionId && c.status === "active",
    );

  const getConnection = (institutionId: string) =>
    connections.find((c) => c.institution_id === institutionId);

  return (
    <AppShell>
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Conectar Banco</h1>
          <p className="text-muted-foreground">
            Conecte suas contas bancárias via Open Finance para sincronizar saldos e transações automaticamente.
          </p>
        </header>

        {/* Status de conexões ativas */}
        {connections.length > 0 && (
          <Card className="p-6">
            <h2 className="font-semibold">Conexões Ativas</h2>
            <div className="mt-4 space-y-3">
              {connections.map((conn) => {
                const inst = institutions.find((i) => i.id === conn.institution_id);
                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="size-8 rounded-full"
                        style={{ backgroundColor: inst?.logo_color ?? "#6366f1" }}
                      />
                      <div>
                        <p className="text-sm font-medium">{inst?.name ?? "Desconhecido"}</p>
                        <p className="text-xs text-muted-foreground">
                          Última sincronização:{" "}
                          {conn.last_sync_at
                            ? formatDistanceToNow(new Date(conn.last_sync_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })
                            : "Nunca"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          conn.status === "active"
                            ? "secondary"
                            : conn.status === "error"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {conn.status === "active"
                          ? "Ativa"
                          : conn.status === "error"
                            ? "Erro"
                            : conn.status === "pending"
                              ? "Pendente"
                              : "Inativa"}
                      </Badge>
                      <Button variant="ghost" size="icon" className="size-8">
                        <RefreshCw className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-danger">
                        <Unplug className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Instituições disponíveis */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Shield className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Instituições Disponíveis</h2>
              <p className="text-sm text-muted-foreground">
                Selecione o banco que deseja conectar.
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {institutions.map((inst) => {
              const connected = isConnected(inst.id);
              const conn = getConnection(inst.id);
              return (
                <div
                  key={inst.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                    connected
                      ? "border-chart-2 bg-chart-2/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="size-8 rounded-full"
                      style={{ backgroundColor: inst.logo_color }}
                    />
                    <div>
                      <p className="text-sm font-medium">{inst.short_name || inst.name}</p>
                      {connected && (
                        <p className="text-xs text-chart-2">Conectado</p>
                      )}
                    </div>
                  </div>
                  {connected ? (
                    <CheckCircle2 className="size-4 text-chart-2" />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleConnect(inst.id)}
                      disabled={connecting && selectedInstitution === inst.id}
                    >
                      {connecting && selectedInstitution === inst.id ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <>
                          Conectar
                          <ArrowRight className="ml-1 size-3" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Informações de segurança */}
        <Card className="p-6">
          <h2 className="font-semibold">Como funciona</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                1
              </div>
              <div>
                <p className="text-sm font-medium">Você autoriza o acesso</p>
                <p className="text-xs text-muted-foreground">
                  Redirecionamos você ao banco para autorizar o compartilhamento de dados.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                2
              </div>
              <div>
                <p className="text-sm font-medium">Sincronização automática</p>
                <p className="text-xs text-muted-foreground">
                  Saldos e transações são atualizados periodicamente.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                3
              </div>
              <div>
                <p className="text-sm font-medium">Você pode revogar a qualquer momento</p>
                <p className="text-xs text-muted-foreground">
                  Acesse Configurações → Segurança para revogar consentimentos.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="size-4" />
            Dados protegidos com criptografia ponta a ponta. Conformidade com Open Finance Brasil.
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
