import { Target } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/format";
import type { Goal } from "@/shared/finance-types";

type ObjetivosCardProps = {
  goals: Goal[];
  isLoading?: boolean;
  hidden?: boolean;
};

export function ObjetivosCard({ goals, isLoading, hidden }: ObjetivosCardProps) {
  const activeGoals = goals
    .filter((g) => g.target > 0 && g.current < g.target)
    .sort((a, b) => b.current / b.target - a.current / a.target)
    .slice(0, 3);

  if (isLoading) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (activeGoals.length === 0) {
    return (
      <Card className="bg-card p-5 shadow-none sm:p-6">
        <h3 className="text-base font-semibold">Objetivos</h3>
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum objetivo em andamento.
        </p>
        <Link
          to="/goals"
          search={{ new: true }}
          className="focus-ring mt-3 inline-block rounded text-sm text-primary underline"
        >
          Criar objetivo
        </Link>
      </Card>
    );
  }

  return (
    <Card className="bg-card p-5 shadow-none sm:p-6">
      <h3 className="text-base font-semibold">Objetivos</h3>
      <div className="mt-4 space-y-4">
        {activeGoals.map((goal) => {
          const progress = Math.min((goal.current / goal.target) * 100, 100);
          const remaining = Math.max(0, goal.target - goal.current);
          return (
            <div key={goal.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-primary" aria-hidden />
                  <span className="text-sm font-medium">{goal.name}</span>
                </div>
                <span className="numeric text-xs text-muted-foreground">
                  {hidden ? "•••" : `${Math.round(progress)}%`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {hidden ? "•••" : formatBRL(goal.current)} de{" "}
                  {hidden ? "•••" : formatBRL(goal.target)}
                </span>
                <span>
                  {hidden ? "•••" : `${formatBRL(remaining)} restante`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <Link
        to="/goals"
        className="focus-ring mt-4 inline-block rounded text-sm text-primary underline"
      >
        VER MAIS
      </Link>
    </Card>
  );
}
