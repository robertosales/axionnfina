import { useState } from "react";
import { toast } from "sonner";
import {
  useMFAFactors,
  useMFAEnroll,
  useMFAChallenge,
  useMFAVerify,
  useMFAUnenroll,
} from "@/hooks/use-mfa";

export function useMFASetupFlow() {
  const { data: factors = [], isLoading } = useMFAFactors();
  const enroll = useMFAEnroll();
  const challenge = useMFAChallenge();
  const verify = useMFAVerify();
  const unenroll = useMFAUnenroll();

  const [step, setStep] = useState<"list" | "enroll" | "verify">("list");
  const [factorName, setFactorName] = useState("");
  const [qrCodeUri, setQrCodeUri] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");

  const handleEnroll = async () => {
    if (!factorName.trim()) return;

    try {
      const result = await enroll.mutateAsync(factorName);
      setQrCodeUri(result.totp?.uri ?? "");
      setSecret(result.totp?.secret ?? "");
      setFactorId(result.id);
      setStep("verify");
    } catch (err) {
      toast.error("Erro ao criar fator MFA");
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;

    try {
      const challengeResult = await challenge.mutateAsync(factorId);

      await verify.mutateAsync({
        factorId,
        challengeId: challengeResult.id,
        code,
      });

      toast.success("MFA configurado com sucesso!");
      setStep("list");
      setCode("");
      setFactorName("");
    } catch (err) {
      toast.error("Código inválido. Tente novamente.");
    }
  };

  const handleDisable = async (fid: string) => {
    try {
      await unenroll.mutateAsync(fid);
      toast.success("MFA removido");
    } catch {
      toast.error("Erro ao remover MFA");
    }
  };

  return {
    factors,
    isLoading,
    step,
    setStep,
    factorName,
    setFactorName,
    qrCodeUri,
    secret,
    code,
    setCode,
    enroll,
    verify,
    handleEnroll,
    handleVerify,
    handleDisable,
  };
}
