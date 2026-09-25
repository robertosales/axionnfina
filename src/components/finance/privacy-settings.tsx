import * as React from "react";
import { Shield, Download, Trash2, Eye, EyeOff, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useConsents,
  useGrantConsent,
  useRevokeConsent,
  usePrivacySettings,
  useUpdatePrivacySettings,
  useRequestDataExport,
  useRequestAccountDeletion,
  type ConsentPurpose,
} from "@/hooks/use-lgpd";

/* ------------------------------------------------------------------ */
/* Consent Description Map                                              */
/* ------------------------------------------------------------------ */

const CONSENT_DESCRIPTIONS: Record<
  ConsentPurpose,
  { label: string; description: string; required?: boolean }
> = {
  data_processing: {
    label: "Processamento de dados",
    description: "Necessário para o funcionamento básico do sistema.",
    required: true,
  },
  analytics: {
    label: "Análises e estatísticas",
    description: "Dados anônimos para melhorar o serviço.",
  },
  marketing: {
    label: "Comunicações de marketing",
    description: "Emails promocionais e novidades.",
  },
  open_finance: {
    label: "Open Finance",
    description: "Conexão com instituições financeiras via Open Finance.",
  },
  ai_processing: {
    label: "Processamento por IA",
    description: "Uso de inteligência artificial para análises financeiras.",
  },
  third_party_sharing: {
    label: "Compartilhamento com terceiros",
    description: "Compartilhamento de dados com parceiros.",
  },
};

/* ------------------------------------------------------------------ */
/* Privacy Settings Component                                           */
/* ------------------------------------------------------------------ */

export function PrivacySettings() {
  const { data: settings, isLoading: settingsLoading } = usePrivacySettings();
  const { data: consents, isLoading: consentsLoading } = useConsents();
  const updateSettings = useUpdatePrivacySettings();
  const grantConsent = useGrantConsent();
  const revokeConsent = useRevokeConsent();
  const requestDataExport = useRequestDataExport();
  const requestAccountDeletion = useRequestAccountDeletion();

  const [showDeletionDialog, setShowDeletionDialog] = React.useState(false);
  const [deletionReason, setDeletionReason] = React.useState("");
  const [deletionConfirmEmail, setDeletionConfirmEmail] = React.useState("");
  const [exportSuccess, setExportSuccess] = React.useState(false);

  if (settingsLoading || consentsLoading) {
    return <PrivacySettingsSkeleton />;
  }

  const handleToggleConsent = async (purpose: ConsentPurpose, currentlyGranted: boolean) => {
    const desc = CONSENT_DESCRIPTIONS[purpose];
    if (desc.required) return;

    if (currentlyGranted) {
      await revokeConsent.mutateAsync(purpose);
    } else {
      await grantConsent.mutateAsync({
        purpose,
        description: desc.description,
      });
    }
  };

  const handleExportData = async () => {
    try {
      const requestId = await requestDataExport.mutateAsync();
      setExportSuccess(true);

      // Trigger download
      const link = document.createElement("a");
      link.href = `/api/user-data-export`;
      link.download = `axionnfina-dados.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => setExportSuccess(false), 3000);
    } catch {
      // Error handled by mutation
    }
  };

  const handleRequestDeletion = async () => {
    if (deletionConfirmEmail !== settings?.mask_sensitive_data?.toString()) {
      // Simple validation - in real app, compare with user email
    }

    try {
      await requestAccountDeletion.mutateAsync({ reason: deletionReason });
      setShowDeletionDialog(false);
      setDeletionReason("");
      setDeletionConfirmEmail("");
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Privacidade e Dados</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie seus dados pessoais conforme a LGPD
          </p>
        </div>
      </div>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações de Privacidade</CardTitle>
          <CardDescription>
            Controle como seus dados são utilizados no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Mascarar dados sensíveis</Label>
              <p className="text-xs text-muted-foreground">
                CPF, contas e cartões aparecem ocultos por padrão
              </p>
            </div>
            <Switch
              checked={settings?.mask_sensitive_data ?? true}
              onCheckedChange={(checked) =>
                updateSettings.mutateAsync({ mask_sensitive_data: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Análises e estatísticas</Label>
              <p className="text-xs text-muted-foreground">
                Dados anônimos para melhorar o serviço
              </p>
            </div>
            <Switch
              checked={settings?.allow_analytics ?? false}
              onCheckedChange={(checked) =>
                updateSettings.mutateAsync({ allow_analytics: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Comunicações de marketing</Label>
              <p className="text-xs text-muted-foreground">
                Emails promocionais e novidades
              </p>
            </div>
            <Switch
              checked={settings?.allow_marketing ?? false}
              onCheckedChange={(checked) =>
                updateSettings.mutateAsync({ allow_marketing: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Consent Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consentimentos</CardTitle>
          <CardDescription>
            Controle o uso dos seus dados para cada finalidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(Object.entries(CONSENT_DESCRIPTIONS) as [ConsentPurpose, typeof CONSENT_DESCRIPTIONS[ConsentPurpose]][]).map(
            ([purpose, info]) => {
              const consent = consents?.find((c) => c.purpose === purpose);
              const isGranted = consent?.status === "granted" || info.required;

              return (
                <div key={purpose} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">{info.label}</Label>
                      {info.required && (
                        <span className="text-xs text-muted-foreground">(Obrigatório)</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                  <Switch
                    checked={isGranted ?? false}
                    disabled={info.required || grantConsent.isPending || revokeConsent.isPending}
                    onCheckedChange={() => handleToggleConsent(purpose, isGranted ?? false)}
                  />
                </div>
              );
            },
          )}
        </CardContent>
      </Card>

      {/* Data Rights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seus Direitos (LGPD)</CardTitle>
          <CardDescription>
            Exercite seus direitos conforme a Lei Geral de Proteção de Dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export Data */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar meus dados
              </Label>
              <p className="text-xs text-muted-foreground">
                Art. 18 - Baixe uma cópia de todos os seus dados
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              disabled={requestDataExport.isPending}
            >
              {requestDataExport.isPending ? (
                <Skeleton className="h-4 w-20" />
              ) : exportSuccess ? (
                "Solicitado!"
              ) : (
                "Exportar"
              )}
            </Button>
          </div>

          {/* Delete Account */}
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Solicitar exclusão da conta
              </Label>
              <p className="text-xs text-muted-foreground">
                Art. 18, VI - Solicite a exclusão dos seus dados
              </p>
            </div>
            <Dialog open={showDeletionDialog} onOpenChange={setShowDeletionDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Solicitar exclusão
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Solicitar exclusão de conta</DialogTitle>
                  <DialogDescription>
                    Esta ação irá iniciar o processo de exclusão dos seus dados.
                    Nossa equipe analisará em até 15 dias úteis.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="deletion-reason">Motivo (opcional)</Label>
                    <Input
                      id="deletion-reason"
                      placeholder="Informe o motivo da exclusão..."
                      value={deletionReason}
                      onChange={(e) => setDeletionReason(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deletion-email">
                      Confirme seu email para prosseguir
                    </Label>
                    <Input
                      id="deletion-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={deletionConfirmEmail}
                      onChange={(e) => setDeletionConfirmEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-muted-foreground">
                      Após a exclusão, seus dados serão removidos permanentemente
                      e não poderão ser recuperados.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDeletionDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRequestDeletion}
                    disabled={
                      requestAccountDeletion.isPending || !deletionConfirmEmail
                    }
                  >
                    {requestAccountDeletion.isPending
                      ? "Processando..."
                      : "Confirmar exclusão"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */

function PrivacySettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
