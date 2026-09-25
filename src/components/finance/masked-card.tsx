import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMasking } from "@/hooks/use-masking";

interface MaskedCardProps {
  value: string;
  brand?: "visa" | "mastercard" | "elo" | "amex" | "discover" | "other";
  showLabel?: boolean;
  className?: string;
}

const LABELS: Record<string, string> = {
  show: "Mostrar dados",
  hide: "Ocultar dados",
};

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "Amex",
  discover: "Discover",
  other: "Cartão",
};

/**
 * Mascara número de cartão de crédito/débito exibindo apenas os últimos 4 dígitos.
 * Exemplo: •••• •••• •••• 4321
 */
export function MaskedCard({ value, brand, showLabel = true, className }: MaskedCardProps) {
  const { isVisible, toggle } = useMasking();

  const formatCard = (card: string, reveal: boolean): string => {
    const numbers = card.replace(/\D/g, "");

    if (reveal) {
      return numbers.replace(/(\d{4})(?=\d)/g, "$1 ");
    }

    const lastFour = numbers.slice(-4);
    return `•••• •••• •••• ${lastFour}`;
  };

  const formatted = formatCard(value, isVisible);
  const label = brand ? BRAND_LABELS[brand] ?? "Cartão" : "Cartão";
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
