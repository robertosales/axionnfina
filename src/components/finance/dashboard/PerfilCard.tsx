import { LogOut, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SessionUser } from "@/hooks/use-session-user";

type PerfilCardProps = {
  user: SessionUser;
};

export function PerfilCard({ user }: PerfilCardProps) {
  return (
    <Card className="bg-card p-4 shadow-none sm:p-5">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          {user.initials ? (
            <span className="text-sm font-semibold">{user.initials}</span>
          ) : (
            <User className="size-6" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          {user.email && (
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => user.signOut()}
          aria-label="Sair da conta"
          className="text-muted-foreground hover:text-danger"
        >
          <LogOut className="size-4" aria-hidden />
        </Button>
      </div>
    </Card>
  );
}
