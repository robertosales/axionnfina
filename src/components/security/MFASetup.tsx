import { Key, QrCode, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMFASetupFlow } from "./use-mfa-setup-flow";

export function MFASetup() {
  const {
    factors,
    isLoading,
    step,
    setStep,
    factorName,
    setFactorName,
    secret,
    code,
    setCode,
    enroll,
    verify,
    handleEnroll,
    handleVerify,
    handleDisable,
  } = useMFASetupFlow();

  if (isLoading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Carregando configurações MFA...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <Key className="size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Autenticação Multifator (MFA)</h2>
          <p className="text-sm text-muted-foreground">
            Adicione uma segunda camada de segurança com códigos TOTP.
          </p>
        </div>
      </div>

      {step === "list" && (
        <div className="mt-4 space-y-3">
          {factors.length > 0 ? (
            factors.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-4 text-chart-2" />
                  <div>
                    <p className="text-sm font-medium">{f.friendly_name || "TOTP"}</p>
                    <p className="text-xs text-muted-foreground">
                      Criado em {new Date(f.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Ativo</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-danger"
                    onClick={() => handleDisable(f.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum fator MFA configurado.
            </p>
          )}

          <Button
            variant="outline"
            onClick={() => setStep("enroll")}
            className="mt-2"
          >
            <Key className="mr-2 size-4" />
            Adicionar fator MFA
          </Button>
        </div>
      )}

      {step === "enroll" && (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-name">Nome do dispositivo</Label>
            <Input
              id="mfa-name"
              placeholder="Ex: Google Authenticator"
              value={factorName}
              onChange={(e) => setFactorName(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep("list")}>
              Cancelar
            </Button>
            <Button onClick={handleEnroll} disabled={!factorName.trim() || enroll.isPending}>
              {enroll.isPending ? "Criando..." : "Continuar"}
            </Button>
          </div>
        </div>
      )}

      {step === "verify" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <QrCode className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Escaneie o QR Code no seu app autenticador
            </p>
            {secret && (
              <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
                Segredo: {secret}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
            <Input
              id="mfa-code"
              type="text"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep("list")}>
              Cancelar
            </Button>
            <Button
              onClick={handleVerify}
              disabled={code.length !== 6 || verify.isPending}
            >
              {verify.isPending ? "Verificando..." : "Verificar e Ativar"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
