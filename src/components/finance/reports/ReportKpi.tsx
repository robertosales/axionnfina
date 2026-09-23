import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

export function ReportKpi({ label, value, icon: Icon, change, tone = "default", note }: { label: string; value: string; icon: LucideIcon; change?: number | null; tone?: "default" | "success" | "warning" | "danger"; note?: string }) {
  const positive = (change ?? 0) > 0;
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-primary";
  return <Card className="h-full border-l-2 border-l-primary p-4 shadow-none">
    <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">{label}</p><Icon className={cn("size-4", color)} aria-hidden/></div>
    <p className={cn("numeric mt-2 text-xl font-semibold sm:text-2xl", color)}>{value}</p>
    <div className="mt-2 flex min-h-5 items-center gap-1 text-xs text-muted-foreground">
      {change === null || change === undefined ? <><Minus className="size-3"/>Sem comparação</> : <>{positive ? <ArrowUpRight className="size-3 text-success"/> : <ArrowDownRight className="size-3 text-danger"/>}<span>{formatPercent(change, 1)} vs. período anterior</span></>}
    </div>{note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
  </Card>;
}
