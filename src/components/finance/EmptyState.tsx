import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    asChild?: ReactNode;
  };
  className?: string;
};

export function EmptyState({
  icon: Icon = Inbox,
  title = "Sem dados",
  description,
  action,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-4 py-10 text-center text-sm",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-muted/60 text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          className="mt-1"
          onClick={action.onClick}
          asChild={!!action.asChild}
        >
          {action.asChild ?? action.label}
        </Button>
      )}
    </div>
  );
}
