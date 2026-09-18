import { cn } from "@/lib/utils";
import { getInitials, hashColor } from "@/components/finance/LogoUpload";
import type { LucideIcon } from "lucide-react";

interface AccountAvatarProps {
  logoUrl: string | null;
  name: string;
  icon?: LucideIcon;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
} as const;

const ICON_SIZE_CLASSES = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
} as const;

const TEXT_SIZE_CLASSES = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

export function AccountAvatar({ logoUrl, name, icon: Icon, size = "md", className }: AccountAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (logoUrl) {
    return (
      <span
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full bg-background",
          sizeClass,
          className,
        )}
      >
        <img
          src={logoUrl}
          alt={name}
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        sizeClass,
        className,
      )}
      style={{ backgroundColor: hashColor(name) }}
    >
      {Icon ? (
        <Icon className={cn("text-white", ICON_SIZE_CLASSES[size])} aria-hidden />
      ) : (
        <span className={cn("font-semibold text-white", TEXT_SIZE_CLASSES[size])}>
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}
