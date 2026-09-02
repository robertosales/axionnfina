import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CheckCircle2, RefreshCw, Shield, Unplug } from "lucide-react";
import { PluggyConnect } from "react-pluggy-connect";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAccountConnections } from "@/hooks/use-wallet";
import { useInstitutions } from "@/lib/finance-data";
import {
  completeConnection,
  createConnectToken,
  listConnectors,
  revokeConnection,
  syncConnection,
} from "@/lib/pluggy.functions";

export const Route = createFileRoute("/_authenticated/wallet/connect")({
  head: () => ({ meta: [{ title: "Conectar Banco — Axionn Finance" }] }),
  component: ConnectPage,
});

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/banco|brasil|pagamentos|unibanco|economica|federal/g, "")
    .replace(/[^a-z0-9]/g, "");

function ConnectPage() {
  const queryClient = useQueryClient();
  const { data: institutions = [] } = useInstitutions();
  const { data: connections = [] } = useAccountConnections();
  const connectorsQuery = useQuery({
    queryKey: ["pluggy-connectors"],
    queryFn: () => listConnectors({ data: {} }),
    staleTime: 3_600_000,
  });
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<number | null>(null);
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busyConnection, setBusyConnection] = useState<string | null>(null);

  const connectorByInstitution = useMemo(() => {
    const connectors = connectorsQuery.data?.connectors ?? [];
    const entries = institutions.flatMap((institution) => {
      const terms = [institution.short_name, institution.name].map(normalizeName).filter(Boolean);
      const connector = connectors.find((candidate) => {
        const name = normalizeName(candidate.name);
        return terms.some((term) => name.includes(term) || term.includes(name));
      });
      return connector ? [[institution.id, connector] as const] : [];
    });
    return new Map(entries);
  }, [connectorsQuery.data?.connectors, institutions]);

  const resetWidget = () => {
    setConnectToken(null);
    setSelectedConnector(null);
    setSelectedInstitution(null);
    setConnecting(false);
  };

  const handleConnect = async (institutionId: string) => {
    const connector = connectorByInstitution.get(institutionId);
    if (!connector) {
      toast.error("Este banco não está disponível na Pluggy neste momento.");
      return;
    }
    setConnecting(true);
    setSelectedInstitution(institutionId);
    try {
      const result = await createConnectToken();
      setSelectedConnector(connector.id);
      setConnectToken(result.connectToken);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar conexão.");
      resetWidget();
    }
  };

  const handleSuccess = async (data: { item: { id: string } }) => {
    if (!selectedInstitution) return;
    try {
      const result = await completeConnection({
        data: { institutionId: selectedInstitution, itemId: data.item.id },
      });
      await queryClient.invalidateQueries();
      toast.success(
        `${result.sync.accountsImported} conta(s), ${result.sync.transactionsImported} movimentação(ões) e ${result.sync.investmentsImported} investimento(s) sincronizados.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar os dados bancários.");
    } finally {
      resetWidget();
    }
  };

  const handleSync = async (connectionId: string) => {
    setBusyConnection(connectionId);
    try {
      const result = await syncConnection({ data: { connectionId } });
      await queryClient.invalidateQueries();
      toast.success(
        `${result.transactionsImported} movimentação(ões) e ${result.investmentsImported} investimento(s) sincronizados.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar.");
    } finally {
      setBusyConnection(null);
    }
  };

  const handleRevoke = async (connectionId: string) => {
    setBusyConnection(connectionId);
    try {
      await revokeConnection({ data: { connectionId } });
      await queryClient.invalidateQueries();
      toast.success("Consentimento revogado e conexão removida da Pluggy.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao revogar a conexão.");
    } finally {
      setBusyConnection(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Conectar Banco</h1>
          <p className="text-muted-foreground">
            Autorize seu banco e importe contas, saldos e todas as movimentações disponíveis.
          </p>
        </header>
        {connections.length > 0 && (
          <Card className="p-6">
            <h2 className="font-semibold">Conexões</h2>
            <div className="mt-4 space-y-3">
              {connections.map((connection) => {
                const institution = institutions.find(
                  (item) => item.id === connection.institution_id,
                );
                const busy = busyConnection === connection.id;
                return (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="size-8 rounded-full"
                        style={{ backgroundColor: institution?.logo_color ?? "#6366f1" }}
                      />
                      <div>
                        <p className="text-sm font-medium">{institution?.name ?? "Instituição"}</p>
                        <p className="text-xs text-muted-foreground">
                          Última sincronização:{" "}
                          {connection.last_sync_at
                            ? formatDistanceToNow(new Date(connection.last_sync_at), {
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
                          connection.status === "active"
                            ? "secondary"
                            : connection.status === "error"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {connection.status === "active"
                          ? "Ativa"
                          : connection.status === "error"
                            ? "Erro"
                            : connection.status === "pending"
                              ? "Pendente"
                              : "Inativa"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={busy}
                        onClick={() => void handleSync(connection.id)}
                        title="Sincronizar agora"
                      >
                        <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-danger"
                        disabled={busy}
                        onClick={() => void handleRevoke(connection.id)}
                        title="Revogar consentimento"
                      >
                        <Unplug className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Shield className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Instituições disponíveis</h2>
              <p className="text-sm text-muted-foreground">
                Selecione o banco para abrir o consentimento oficial.
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {institutions.map((institution) => {
              const connection = connections.find((item) => item.institution_id === institution.id);
              const connected = connection?.status === "active";
              const available = connectorByInstitution.has(institution.id);
              return (
                <div
                  key={institution.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${connected ? "border-chart-2 bg-chart-2/5" : "border-border hover:border-primary/50"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="size-8 rounded-full"
                      style={{ backgroundColor: institution.logo_color ?? "#6366f1" }}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {institution.short_name || institution.name}
                      </p>
                      <p
                        className={`text-xs ${connected ? "text-chart-2" : "text-muted-foreground"}`}
                      >
                        {connected ? "Conectado" : available ? "Disponível" : "Indisponível"}
                      </p>
                    </div>
                  </div>
                  {connected ? (
                    <CheckCircle2 className="size-4 text-chart-2" />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleConnect(institution.id)}
                      disabled={!available || connecting}
                    >
                      {connecting && selectedInstitution === institution.id ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <>
                          Conectar <ArrowRight className="ml-1 size-3" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {(connectorsQuery.isError || connectorsQuery.data?.error) && (
            <p className="mt-4 text-sm text-danger">
              Não foi possível carregar a Pluggy. Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET
              no servidor.
            </p>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold">Como funciona</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A autenticação acontece no ambiente da instituição. O Axionn recebe somente os dados
            autorizados, sincroniza todas as páginas disponíveis e permite revogar o consentimento a
            qualquer momento.
          </p>
        </Card>
      </div>
      {connectToken && selectedConnector && (
        <PluggyConnect
          connectToken={connectToken}
          selectedConnectorId={selectedConnector}
          includeSandbox
          countries={["BR"]}
          products={["ACCOUNTS", "TRANSACTIONS", "INVESTMENTS", "INVESTMENTS_TRANSACTIONS"]}
          language="pt"
          onSuccess={handleSuccess}
          onError={(error) => {
            toast.error(error.message || "A conexão não foi concluída.");
            resetWidget();
          }}
          onClose={resetWidget}
        />
      )}
    </AppShell>
  );
}
