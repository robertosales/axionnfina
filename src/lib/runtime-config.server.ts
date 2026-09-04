export type RuntimeCheck = {
  name: string;
  ok: boolean;
  message: string;
};

function present(env: Record<string, string | undefined>, name: string) {
  return Boolean(env[name]?.trim());
}

export function validateRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): RuntimeCheck[] {
  const checks: RuntimeCheck[] = [
    {
      name: "supabase",
      ok: present(env, "SUPABASE_URL") && present(env, "SUPABASE_PUBLISHABLE_KEY"),
      message: "Cliente Supabase configurado no servidor",
    },
    {
      name: "service-role",
      ok: present(env, "SUPABASE_SERVICE_ROLE_KEY"),
      message: "Processamento protegido de webhooks e rotinas",
    },
    {
      name: "cron-secret",
      ok: present(env, "INVESTMENT_RADAR_CRON_SECRET"),
      message: "Agendamento diário autenticado",
    },
    {
      name: "open-finance",
      ok:
        env["OPEN_FINANCE_ENABLED"] !== "true" ||
        (present(env, "PLUGGY_CLIENT_ID") &&
          present(env, "PLUGGY_CLIENT_SECRET") &&
          present(env, "PLUGGY_WEBHOOK_SECRET")),
      message: "Credenciais do conector Open Finance",
    },
  ];

  const provider = (env["AI_PROVIDER"] ?? "cloudflare").trim().toLowerCase();
  checks.push({
    name: "ai-provider",
    ok:
      provider === "cloudflare"
        ? present(env, "CLOUDFLARE_ACCOUNT_ID") && present(env, "CLOUDFLARE_API_TOKEN")
        : provider === "lovable" && present(env, "LOVABLE_API_KEY"),
    message: "Provedor de IA explicitamente configurado",
  });

  const appUrl = env["APP_URL"]?.trim();
  checks.push({
    name: "public-url",
    ok: Boolean(appUrl && /^https:\/\//i.test(appUrl) && !appUrl.includes("example.com")),
    message: "URL pública HTTPS sem valor demonstrativo",
  });
  return checks;
}
