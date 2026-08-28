import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Monitor,
  Key,
  ShieldCheck,
  Globe,
  LogOut,
  ShieldAlert,
  Smartphone,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { MFASetup } from "@/components/security/MFASetup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  useDevices,
  useRevokeDevice,
  useRevokeAllSessions,
  useSecurityEvents,
  useSecuritySummary,
  useSessions,
} from "@/hooks/use-security";
import type { SecuritySummary } from "@/hooks/use-security";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({
    meta: [
      { title: "Segurança — Axionn Finance" },
      {
        name: "description",
        content:
          "Central de segurança: dispositivos, sessões, eventos e autenticação multifator.",
      },
      { property: "og:title", content: "Segurança — Axionn Finance" },
    ],
  }),
  component: SecurityPage,
});

function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
    low: { color: "text-chart-2", icon: CheckCircle2 },
    medium: { color: "text-chart-4", icon: AlertTriangle },
    high: { color: "text-orange-500", icon: ShieldAlert },
    critical: { color: "text-danger", icon: XCircle },
  };
  const v = variants[severity] ?? variants["low"]!;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className="gap-1 text-xs">
      <Icon className={`size-3 ${v.color}`} />
      {severity}
    </Badge>
  );
}

function EventTypeLabel({ eventType }: { eventType: string }) {
  const labels: Record<string, string> = {
    login: "Login",
    logout: "Logout",
    login_failed: "Falha de login",
    mfa_enabled: "MFA ativado",
    mfa_disabled: "MFA desativado",
    mfa_challenge_success: "MFA verificado",
    mfa_challenge_failed: "MFA falhou",
    password_changed: "Senha alterada",
    password_reset_requested: "Redefinição solicitada",
    password_reset_completed: "Redefinição concluída",
    account_connected: "Conta conectada",
    account_removed: "Conta removida",
    consent_created: "Consentimento criado",
    consent_revoked: "Consentimento revogado",
    payment_created: "Pagamento criado",
    payment_confirmed: "Pagamento confirmado",
    payment_cancelled: "Pagamento cancelado",
    payment_settled: "Pagamento liquidado",
    profile_changed: "Perfil alterado",
    investment_simulation: "Simulação de investimento",
    recommendation_generated: "Recomendação gerada",
    data_exported: "Dados exportados",
    account_deleted: "Conta excluída",
    session_revoked: "Sessão revogada",
    device_added: "Dispositivo adicionado",
    device_removed: "Dispositivo removido",
    suspicious_activity: "Atividade suspeita",
  };
  return <span>{labels[eventType] ?? eventType}</span>;
}

function DeviceIcon({ type }: { type: string }) {
  if (type === "mobile") return <Smartphone className="size-4" />;
  return <Monitor className="size-4" />;
}

function SummaryCard({
  summary,
}: {
  summary: SecuritySummary | undefined;
  isLoading: boolean;
}) {
  if (!summary) return null;

  const items = [
    {
      label: "Dispositivos ativos",
      value: summary.active_devices,
      icon: Monitor,
      color: "text-chart-1",
    },
    {
      label: "Sessões ativas",
      value: summary.active_sessions,
      icon: Globe,
      color: "text-chart-2",
    },
    {
      label: "Falhas de login (24h)",
      value: summary.failed_logins_24h,
      icon: XCircle,
      color: summary.failed_logins_24h > 0 ? "text-orange-500" : "text-chart-2",
    },
    {
      label: "Atividade suspeita (7d)",
      value: summary.suspicious_count,
      icon: ShieldAlert,
      color: summary.suspicious_count > 0 ? "text-danger" : "text-chart-2",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
          <div className="flex items-center gap-3">
            <item.icon className={`size-5 ${item.color}`} />
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-2xl font-bold">{item.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SecurityPage() {
  const { data: summary, isLoading: summaryLoading } = useSecuritySummary();
  const { data: events = [], isLoading: eventsLoading } = useSecurityEvents(15);
  const { data: devices = [], isLoading: devicesLoading } = useDevices();
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions();
  const revokeDevice = useRevokeDevice();
  const revokeAllSessions = useRevokeAllSessions();

  const handleRevokeDevice = async (deviceId: string, name: string) => {
    try {
      await revokeDevice.mutateAsync(deviceId);
      toast.success(`Dispositivo "${name}" revogado`);
    } catch {
      toast.error("Erro ao revogar dispositivo");
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      const count = await revokeAllSessions.mutateAsync();
      toast.success(`${count} sessão(ões) revogada(s)`);
    } catch {
      toast.error("Erro ao revogar sessões");
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Segurança</h1>
          <p className="text-muted-foreground">
            Gerencie dispositivos, sessões, autenticação e monitoramento de segurança.
          </p>
        </header>

        {/* Summary KPIs */}
        <SummaryCard summary={summary} isLoading={summaryLoading} />

        {/* MFA Section */}
        <MFASetup />

        {/* Devices */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="size-5 text-primary" />
              <div>
                <h2 className="font-semibold">Dispositivos</h2>
                <p className="text-sm text-muted-foreground">
                  Dispositivos que acessaram sua conta.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {devicesLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dispositivo registrado.</p>
            ) : (
              devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <DeviceIcon type={device.device_type} />
                    <div>
                      <p className="text-sm font-medium">{device.device_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.os} · {device.browser ?? "Desconhecido"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Último acesso:{" "}
                        {formatDistanceToNow(new Date(device.last_seen_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {device.is_trusted ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="size-3" />
                        Confiável
                      </Badge>
                    ) : (
                      <Badge variant="outline">Não confiável</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-danger"
                      onClick={() => handleRevokeDevice(device.id, device.device_name)}
                      title="Revogar dispositivo"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Sessions */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="size-5 text-primary" />
              <div>
                <h2 className="font-semibold">Sessões Ativas</h2>
                <p className="text-sm text-muted-foreground">
                  Sessões abertas na sua conta.
                </p>
              </div>
            </div>
            {sessions.filter((s) => s.is_active).length > 1 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevokeAllSessions}
              >
                <LogOut className="mr-2 size-4" />
                Revogar todas
              </Button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {sessionsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>
            ) : (
              sessions.slice(0, 10).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="size-4" />
                    <div>
                      <p className="text-sm font-medium">
                        {session.ip_address ?? "IP desconhecido"}
                        {session.country && ` · ${session.country}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.user_agent?.slice(0, 60) ?? "User agent desconhecido"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Clock className="mr-1 inline size-3" />
                        Início:{" "}
                        {formatDistanceToNow(new Date(session.started_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={session.is_active ? "secondary" : "outline"}>
                    {session.is_active ? "Ativa" : "Encerrada"}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Security Events */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Eventos de Segurança</h2>
              <p className="text-sm text-muted-foreground">
                Histórico de eventos de segurança da sua conta.
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="space-y-2">
            {eventsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <EventTypeLabel eventType={event.event_type} />
                    <span className="text-xs text-muted-foreground">
                      {event.ip_address && `${event.ip_address} · `}
                      {formatDistanceToNow(new Date(event.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <SeverityBadge severity={event.severity} />
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Quick Security Actions */}
        <Card className="p-6">
          <h2 className="font-semibold">Ações Rápidas</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" size="sm">
              <Key className="mr-2 size-4" />
              Alterar senha
            </Button>
            <Button variant="outline" size="sm">
              <ShieldCheck className="mr-2 size-4" />
              Revogar todos os consentimentos
            </Button>
            <Button variant="outline" size="sm" className="text-danger hover:text-danger">
              <Trash2 className="mr-2 size-4" />
              Excluir conta
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
