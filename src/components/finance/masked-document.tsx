import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMasking } from "@/hooks/use-masking";

interface MaskedDocumentProps {
  value: string;
  type?: "cpf" | "cnpj";
  showLabel?: boolean;
  className?: string;
}

const LABELS: Record<string, string> = {
  show: "Mostrar dados",
  hide: "Ocultar dados",
};

/** Mascara CPF/CNPJ exibindo apenas os ultimos digitos. */
export function MaskedDocument({ value, type, showLabel = true, className }: MaskedDocumentProps) {
  const { isVisible, toggle } = useMasking();
  const detectedType = type ?? (value.replace(/\D/g, "").length === 11 ? "cpf" : "cnpj");

  const formatDocument = (doc: string, reveal: boolean): string => {
    const numbers = doc.replace(/\D/g, "");

    if (reveal) {
      if (detectedType === "cpf") {
        return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      }
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }

    if (detectedType === "cpf") {
      return `***.***.***-${numbers.slice(-2)}`;
    }
    return `**.***.***/****-${numbers.slice(-2)}`;
  };

  const formatted = formatDocument(value, isVisible);
  const label = detectedType === "cpf" ? "CPF" : "CNPJ";
  const ariaLabel = isVisible ? LABELS.hide : LABELS.show;

  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono", className)}>
      {showLabel && <span className="text-xs text-muted-foreground">{label}:</span>}
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
