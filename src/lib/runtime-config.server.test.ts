import { describe, expect, it } from "vitest";

import { validateRuntimeConfig } from "./runtime-config.server";

const complete = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public",
  SUPABASE_SERVICE_ROLE_KEY: "server-only",
  INVESTMENT_RADAR_CRON_SECRET: "cron",
  OPEN_FINANCE_ENABLED: "true",
  PLUGGY_CLIENT_ID: "id",
  PLUGGY_CLIENT_SECRET: "secret",
  PLUGGY_WEBHOOK_SECRET: "webhook",
  AI_PROVIDER: "cloudflare",
  CLOUDFLARE_ACCOUNT_ID: "account",
  CLOUDFLARE_API_TOKEN: "token",
  APP_URL: "https://app.axionn.finance",
};

describe("validateRuntimeConfig", () => {
  it("aprova uma configuração completa sem expor valores", () => {
    expect(validateRuntimeConfig(complete).every((check) => check.ok)).toBe(true);
  });

  it("reprova URL de exemplo e segredo ausente", () => {
    const checks = validateRuntimeConfig({
      ...complete,
      APP_URL: "https://app.example.com",
      PLUGGY_WEBHOOK_SECRET: "",
    });
    expect(checks.find((check) => check.name === "public-url")?.ok).toBe(false);
    expect(checks.find((check) => check.name === "open-finance")?.ok).toBe(false);
  });
});
