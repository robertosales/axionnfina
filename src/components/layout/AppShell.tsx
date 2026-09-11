import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  CalendarClock,
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
  Plus,
  Receipt,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Target,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { CommandPalette } from "@/components/layout/CommandPalette";
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
import { useSessionUser } from "@/hooks/use-session-user";
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
  {
    to: "/bills",
    label: "Contas a pagar e receber",
    icon: CalendarClock,
    group: "Vida financeira",
  },
  { to: "/wallet/imports", label: "Importar documentos", icon: FileText, group: "Vida financeira" },
  { to: "/reconciliation", label: "Conferir saldos", icon: Receipt, group: "Vida financeira" },
  { to: "/investments", label: "Investimentos", icon: LineChart, group: "Investimentos" },
  { to: "/goals", label: "Metas", icon: Target, group: "Planejamento" },
  { to: "/budget", label: "Orçamento", icon: PiggyBank, group: "Planejamento" },
  { to: "/reports", label: "Relatórios", icon: FileText, group: "Planejamento" },
  { to: "/taxes", label: "Impostos", icon: FileText, group: "Planejamento" },
  { to: "/security", label: "Segurança", icon: Shield, group: "Sistema" },
  { to: "/settings", label: "Configurações", icon: Settings, group: "Sistema" },
];

function readPreference(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences remain usable for this session if browser storage is unavailable.
  }
}

function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const isDark = readPreference("axionn-theme") !== "light";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    savePreference("axionn-theme", next ? "dark" : "light");
  };
  return { dark, toggle };
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      to="/dashboard"
      aria-label="Axionn Finance — início"
      className="focus-ring flex min-w-0 items-center gap-3 rounded-xl"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-action text-action-foreground">
        <Coins className="size-6" aria-hidden />
      </span>
      {!collapsed && (
        <span className="whitespace-nowrap text-xl font-semibold tracking-tight">
          Axionn<span className="font-normal text-muted-foreground">Fina</span>
        </span>
      )}
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
            to={item.to}
            onClick={onNavigate}
            aria-label={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:absolute before:-left-3 before:h-6 before:w-1 before:rounded-r-full before:bg-action"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <item.icon
              className={cn("size-[19px] shrink-0", active && "text-sidebar-primary")}
              aria-hidden
            />
            {!collapsed && <span className="min-w-0 leading-snug">{item.label}</span>}
            {!collapsed && item.highlight && (
              <Badge variant="secondary" className="ml-auto rounded-full text-[10px]">
                beta
              </Badge>
            )}
          </Link>
        );
        return (
          <div key={item.to}>
            {navItems[index - 1]?.group !== item.group &&
              (collapsed ? (
                index > 0 && <div className="mx-3 my-3 border-t border-sidebar-border" />
              ) : (
                <p className="px-3 pb-2 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {item.group}
                </p>
              ))}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  onNewTransaction,
  newTransactionDisabled = false,
}: {
  children: ReactNode;
  onNewTransaction?: () => void;
  newTransactionDisabled?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const { name, initials, signOut } = useSessionUser();

  useEffect(() => {
    setCollapsed(readPreference("axionn-sidebar") === "collapsed");
  }, []);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    savePreference("axionn-sidebar", next ? "collapsed" : "expanded");
  };

  const newAction = (compact: boolean, closeMobile = false) => (
    <Button
      asChild={!onNewTransaction}
      disabled={newTransactionDisabled}
      className={cn("h-12", compact ? "w-12 px-0" : "w-full justify-start px-5")}
      aria-label="Novo lançamento"
      title={compact ? "Novo lançamento" : undefined}
      onClick={
        onNewTransaction
          ? () => {
              if (closeMobile) setMobileOpen(false);
              onNewTransaction();
            }
          : undefined
      }
    >
      {onNewTransaction ? (
        <>
          <Plus aria-hidden />
          {!compact && "Novo lançamento"}
        </>
      ) : (
        <Link
          to="/transactions"
          search={{ new: true }}
          onClick={() => closeMobile && setMobileOpen(false)}
        >
          <Plus aria-hidden />
          {!compact && "Novo lançamento"}
        </Link>
      )}
    </Button>
  );

  return (
    <div
      className="min-h-screen bg-background"
      style={{ "--sidebar-width": collapsed ? "80px" : "264px" } as CSSProperties}
    >
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-xl bg-action px-4 py-3 text-action-foreground focus:not-sr-only"
      >
        Ir para o conteúdo
      </a>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <aside
        id="desktop-sidebar"
        aria-label="Menu lateral"
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex"
      >
        <div
          className={cn("flex h-24 shrink-0 items-center px-6", collapsed && "justify-center px-0")}
        >
          <Brand collapsed={collapsed} />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          className="absolute -right-4 top-8 size-8 bg-sidebar text-muted-foreground"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          aria-controls="desktop-sidebar"
        >
          {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
        </Button>
        <div className={cn("px-5 pb-2", collapsed && "px-4")}>{newAction(collapsed)}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-5">
          <NavList collapsed={collapsed} />
        </div>
      </aside>

      <div className="transition-[padding-left] duration-200 lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-border/50 bg-background px-4 sm:px-6 lg:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[min(300px,calc(100vw-2rem))] flex-col gap-0 bg-sidebar p-0"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex h-20 shrink-0 items-center px-5">
                <Brand collapsed={false} />
              </div>
              <div className="px-5 pb-2">{newAction(false, true)}</div>
              <div className="min-h-0 flex-1 overflow-y-auto pb-6">
                <NavList collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="hidden sm:block lg:hidden">
            <Brand collapsed />
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="focus-ring hidden h-11 min-w-0 flex-1 max-w-sm items-center gap-3 rounded-full bg-card px-4 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Buscar ou perguntar ao agente…</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setPaletteOpen(true)}
            aria-label="Buscar"
          >
            <Search aria-hidden />
          </Button>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Alternar tema"
              title={dark ? "Usar tema claro" : "Usar tema escuro"}
            >
              {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="max-w-60 gap-3 px-2 sm:px-3"
                  aria-label="Menu do perfil"
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-40 truncate lg:block">{name}</span>
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
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-[calc(100vh-5rem)] px-4 py-6 pb-28 outline-none sm:px-6 lg:px-8 lg:py-8 lg:pb-10"
        >
          <div className="app-page mx-auto w-full min-w-0 max-w-[1600px]">{children}</div>
        </main>
      </div>

      <nav
        aria-label="Navegação inferior"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        {["/dashboard", "/wallet", "/investments", "/goals", "/agent"].map((to) => {
          const item = navItems.find((entry) => entry.to === to)!;
          return (
            <Link
              key={to}
              to={to}
              aria-current={pathname === to ? "page" : undefined}
              className={cn(
                "focus-ring flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px]",
                pathname === to ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
