import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Coins, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Axionn Finance" },
      {
        name: "description",
        content:
          "Acesse sua conta Axionn Finance para acompanhar patrimônio, orçamento, metas e o agente financeiro.",
      },
      { property: "og:title", content: "Entrar — Axionn Finance" },
      {
        property: "og:description",
        content: "Acesse sua conta Axionn Finance e converse com seu agente financeiro pessoal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");

  useEffect(() => {
    let active = true;

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.warn("[Auth] Could not restore the stored session.", error.message);
          return;
        }

        if (active && data.session) {
          void navigate({ to: "/dashboard", replace: true });
        }
      })
      .catch((error) => {
        // A storage or network failure should leave the login form usable.
        console.error("[Auth] Failed to read the stored session.", error);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Confira seu e-mail para confirmar a conta.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Falha ao entrar com Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="grid size-11 place-items-center rounded-xl text-action-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Coins className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Axionn Finance</h1>
            <p className="text-sm text-muted-foreground">Seu agente financeiro pessoal</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "signin" ? "Entrar" : "Criar conta"}</CardTitle>
            <CardDescription>
              Use e-mail e senha ou sua conta Google para acessar o painel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" />
              <TabsContent value="signup" />
            </Tabs>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nome</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Como devemos te chamar?"
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="relative text-center">
              <span className="relative z-10 bg-card px-3 text-xs uppercase tracking-wide text-muted-foreground">
                ou
              </span>
              <span className="absolute inset-x-0 top-1/2 -z-0 block h-px bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={loading}
            >
              Continuar com Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
