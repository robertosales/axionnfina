import { useNavigate } from "@tanstack/react-router";
import { Bot, Plus, RefreshCw, Send, Target } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Paleta de comandos global (Cmd+K / Ctrl+K). */
export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const run = (label: string, action?: () => void) => {
    onOpenChange(false);
    if (action) action();
    else toast.info(`${label} chega na próxima fase.`);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Digite um comando ou pergunte ao agente…" />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => run("Nova transação")}>
            <Plus className="size-4" /> Nova transação
          </CommandItem>
          <CommandItem onSelect={() => run("Novo Pix")}>
            <Send className="size-4" /> Novo Pix
          </CommandItem>
          <CommandItem onSelect={() => run("Sincronizar bancos")}>
            <RefreshCw className="size-4" /> Sincronizar bancos
          </CommandItem>
          <CommandItem onSelect={() => run("Criar meta")}>
            <Target className="size-4" /> Criar meta
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navegar">
          <CommandItem onSelect={() => run("Agente", () => navigate({ to: "/" }))}>
            <Bot className="size-4" /> Perguntar ao agente
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
