import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CalendarClock,
  Bot,
  Coins,
  CreditCard,
  FileText,
  LayoutDashboard,
  LineChart,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PiggyBank,
  Receipt,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Target,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { CommandPalette } from "@/components/layout/CommandPalette";
import { useSessionUser } from "@/hooks/use-session-user";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  highlight?: boolean;
  group: string;
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard, group: "Visão geral" },
  { to: "/insights", label: "Insights", icon: Sparkles, group: "Visão geral" },
  { to: "/agent", label: "Agente", icon: Bot, highlight: true, group: "Visão geral" },
  { to: "/wallet", label: "Carteira", icon: Wallet, group: "Vida financeira" },
  { to: "/wallet/accounts", label: "Contas bancárias", icon: CreditCard, group: "Vida financeira" },
  { to: "/transactions", label: "Transações", icon: Receipt, group: "Vida financeira" },
  { to: "/bills", label: "Contas a pagar", icon: CalendarClock, group: "Vida financeira" },
  { to: "/wallet/imports", label: "Importar documentos", icon: FileText, group: "Vida financeira" },
  { to: "/investments", label: "Investimentos", icon: LineChart, group: "Investimentos" },
  { to: "/goals", label: "Metas", icon: Target, group: "Planejamento" },
  { to: "/budget", label: "Orçamento", icon: PiggyBank, group: "Planejamento" },
  { to: "/taxes", label: "Impostos", icon: FileText, group: "Planejamento" },
  { to: "/security", label: "Segurança", icon: Shield, group: "Sistema" },
  { to: "/settings", label: "Configurações", icon: Settings, group: "Sistema" },
];

function useTheme() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem("axionn-theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem("axionn-theme", next ? "dark" : "light");
      return next;
    });
  };

  return { dark, toggle };
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link to="/dashboard" className="focus-ring flex items-center gap-2.5 rounded-lg px-1 py-1">
      <motion.span
        layout
        className="grid size-9 shrink-0 place-items-center rounded-xl text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Coins className="size-5" aria-hidden />
      </motion.span>
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex overflow-hidden whitespace-nowrap"
          >
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">Axionn</span>
              <span className="text-[11px] text-muted-foreground">Finance</span>
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1 px-3">
      {navItems.map((item, index) => {
        const active =
          pathname === item.to || (item.to !== "/wallet" && pathname.startsWith(`${item.to}/`));
        const link = (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-label={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
              "transition-[color,background-color,box-shadow] duration-150 ease-out",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-elevation-1"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <item.icon
              className={cn(
                "size-[18px] shrink-0",
                item.highlight && !active && "text-primary",
                active && "text-sidebar-primary",
              )}
              aria-hidden
            />
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            {!collapsed && item.highlight && (
              <Badge variant="secondary" className="ml-auto rounded-full text-[10px]">
                beta
              </Badge>
            )}
          </Link>
        );

        if (!collapsed)
          return (
            <div key={item.to}>
              {navItems[index - 1]?.group !== item.group && (
                <p className="px-3 pb-2 pt-4 text-xs font-semibold text-muted-foreground">
                  {item.group}
                </p>
              )}
              {link}
            </div>
          );
        return (
          <Tooltip key={item.to}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const { name, initials, signOut } = useSessionUser();

  return (
    <div className="min-h-screen bg-background">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 256 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar",
          "lg:flex",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-4",
            collapsed && "justify-center px-0",
          )}
        >
          <Brand collapsed={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavList collapsed={collapsed} />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((v) => !v)}
            className="w-full justify-center text-muted-foreground"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" /> Recolher
              </>
            )}
          </Button>
        </div>
      </motion.aside>

      {/* Main content */}
      <motion.div
        animate={{ paddingLeft: collapsed ? 80 : 256 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="hidden lg:block"
      >
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md lg:px-10">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="focus-ring hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:flex"
          >
            <Search className="size-4" aria-hidden />
            <span>Buscar ou perguntar ao agente…</span>
            <kbd className="numeric ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setPaletteOpen(true)}
              aria-label="Buscar"
            >
              <Search className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
              {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
              <Bell className="size-5" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-background" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-1" aria-label="Menu do perfil">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings">Configurações</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-6 lg:p-10">
          <div className="mx-auto w-full max-w-7xl">{!mobile && children}</div>
        </main>
      </motion.div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex h-16 items-center border-b border-sidebar-border px-4">
                <Brand collapsed={false} />
              </div>
              <div className="overflow-y-auto py-4">
                <NavList collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <Brand collapsed />

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
              {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-1" aria-label="Menu do perfil">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings">Configurações</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 pb-28">
          <div className="mx-auto w-full max-w-7xl">{mobile && children}</div>
        </main>
        <nav
          aria-label="Navegação inferior"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {navItems
            .filter((item) =>
              ["/dashboard", "/wallet", "/investments", "/goals", "/agent"].includes(item.to),
            )
            .sort(
              (a, b) =>
                ["/dashboard", "/wallet", "/investments", "/goals", "/agent"].indexOf(a.to) -
                ["/dashboard", "/wallet", "/investments", "/goals", "/agent"].indexOf(b.to),
            )
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={pathname === item.to ? "page" : undefined}
                className={cn(
                  "focus-ring flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-[10px]",
                  pathname === item.to
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            ))}
        </nav>
      </div>
    </div>
  );
}
