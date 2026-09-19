import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { resolveBankLogoByCompe } from "@/lib/bank-logos";

type InstitutionLogoProps = {
  institutionName: string;
  compeCode?: string | null;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_MAP = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function InstitutionLogo({
  institutionName,
  compeCode,
  logoUrl,
  size = "md",
  className,
}: InstitutionLogoProps) {
  const [imgError, setImgError] = useState(false);

  const resolvedUrl = useMemo(() => {
    if (logoUrl) return logoUrl;
    if (compeCode) return resolveBankLogoByCompe(compeCode);
    return null;
  }, [logoUrl, compeCode]);

  const showImage = resolvedUrl && !imgError;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground overflow-hidden shrink-0",
        SIZE_MAP[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={resolvedUrl!}
          alt={`Logo ${institutionName}`}
          className="h-full w-full object-contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className={cn(
            "select-none font-bold leading-none",
            size === "sm" && "text-[10px]",
            size === "md" && "text-xs",
            size === "lg" && "text-sm",
          )}
          style={{ color: hashColor(institutionName) }}
        >
          {getInitials(institutionName)}
        </span>
      )}
    </div>
  );
}
