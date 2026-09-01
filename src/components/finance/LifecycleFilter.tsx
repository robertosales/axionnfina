import { Archive } from "lucide-react";

import { Button } from "@/components/ui/button";

type LifecycleFilterProps = {
  showArchived: boolean;
  archivedCount?: number;
  onToggle: () => void;
};

export function LifecycleFilter({
  showArchived,
  archivedCount = 0,
  onToggle,
}: LifecycleFilterProps) {
  return (
    <Button
      type="button"
      variant={showArchived ? "secondary" : "outline"}
      size="sm"
      onClick={onToggle}
    >
      <Archive className="size-4" />
      {showArchived ? "Ver ativos" : `Arquivados${archivedCount ? ` (${archivedCount})` : ""}`}
    </Button>
  );
}
