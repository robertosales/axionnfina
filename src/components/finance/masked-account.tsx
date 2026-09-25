import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMasking } from "@/hooks/use-masking";

interface MaskedAccountProps {
  value: string;
  bankCode?: string;
  accountType?: "checking" | "savings" | "salary" | "payment";
  showLabel?: boolean;
  className?: string;
}

const LABELS: Record<string, string> = {
  show: "Mostrar dados",
  hide: "Ocultar dados",
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  salary: "Conta Salário",
  payment: "Conta de Pagamento",
};

/**
 * Mascara número de conta bancária exibindo apenas os últimos dígitos.
 * Exemplo: ****1234
 */
export function MaskedAccount({
  value,
  bankCode,
  accountType,
  showLabel = true,
  className,
}: MaskedAccountProps) {
  const { isVisible, toggle } = useMasking();

  const formatAccount = (account: string, reveal: boolean): string => {
    const numbers = account.replace(/\D/g, "");

    if (reveal) {
      return numbers;
    }

    if (numbers.length <= 4) {
      return "*".repeat(numbers.length);
    }

    return `${"*".repeat(numbers.length - 4)}${numbers.slice(-4)}`;
  };

  const formatted = formatAccount(value, isVisible);
  const label = accountType ? ACCOUNT_TYPE_LABELS[accountType] ?? "Conta" : "Conta";
  const ariaLabel = isVisible ? LABELS["hide"] : LABELS["show"];

  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono", className)}>
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {bankCode ? `${bankCode}/` : ""}{label}:
        </span>
      )}
      <span className="tracking-wider">{formatted}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggle} aria-label={ariaLabel}>
            {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{ariaLabel}</p>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
