import { describe, expect, it } from "vitest";

import {
  AiConfigurationError,
  DEFAULT_CLOUDFLARE_AI_MODEL,
  resolveAiProviderConfig,
} from "./ai-provider.server";

describe("resolveAiProviderConfig", () => {
  it("usa Cloudflare por padrão e não recorre ao Lovable", () => {
    const config = resolveAiProviderConfig({
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_API_TOKEN: "secret-token",
      LOVABLE_API_KEY: "lovable-secret",
    });

    expect(config.provider).toBe("cloudflare");
    expect(config.modelId).toBe(DEFAULT_CLOUDFLARE_AI_MODEL);
    expect(config.baseURL).toContain("/accounts/account-id/ai/v1");
    expect(config.apiKey).toBe("secret-token");
  });

  it("falha quando Cloudflare está incompleto, mesmo com Lovable configurado", () => {
    expect(() =>
      resolveAiProviderConfig({
        AI_PROVIDER: "cloudflare",
        LOVABLE_API_KEY: "lovable-secret",
      }),
    ).toThrow(AiConfigurationError);
  });

  it("permite rollback explícito para o Lovable", () => {
    const config = resolveAiProviderConfig({
      AI_PROVIDER: "lovable",
      LOVABLE_API_KEY: "lovable-secret",
    });

    expect(config.provider).toBe("lovable");
    expect(config.headers).toEqual({ "Lovable-API-Key": "lovable-secret" });
    expect(config.apiKey).toBeUndefined();
  });

  it("aceita um modelo configurado pelo ambiente", () => {
    const config = resolveAiProviderConfig({
      AI_PROVIDER: "cloudflare",
      AI_MODEL: "@cf/modelo/teste",
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_API_TOKEN: "secret-token",
    });

    expect(config.modelId).toBe("@cf/modelo/teste");
  });
});
