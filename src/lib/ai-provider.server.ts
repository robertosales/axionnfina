import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const DEFAULT_CLOUDFLARE_AI_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export const DEFAULT_LOVABLE_AI_MODEL = "google/gemini-3.8-flash";

export type AiProviderName = "cloudflare" | "lovable";

type AiEnvironment = Record<string, string | undefined>;

export type AiProviderConfig = {
  provider: AiProviderName;
  modelId: string;
  baseURL: string;
  apiKey?: string;
  headers?: Record<string, string>;
};

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

/**
 * Resolve o provedor sem fallback automático. Uma configuração incompleta deve
 * interromper o chat, em vez de consumir créditos de outro provedor sem aviso.
 */
export function resolveAiProviderConfig(env: AiEnvironment): AiProviderConfig {
  const rawProvider = (env["AI_PROVIDER"] ?? "lovable").trim().toLowerCase();

  if (rawProvider === "cloudflare") {
    const accountId = env["CLOUDFLARE_ACCOUNT_ID"]?.trim();
    const apiToken = env["CLOUDFLARE_API_TOKEN"]?.trim();
    if (!accountId || !apiToken) {
      // Cloudflare incompleto: usa Lovable AI quando disponível, em vez de derrubar o chat.
      if (env["LOVABLE_API_KEY"]?.trim()) {
        return resolveAiProviderConfig({ ...env, AI_PROVIDER: "lovable" });
      }
      throw new AiConfigurationError(
        "Cloudflare Workers AI não configurado. Defina CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN no servidor.",
      );
    }

    return {
      provider: "cloudflare",
      modelId: env["AI_MODEL"]?.trim() || DEFAULT_CLOUDFLARE_AI_MODEL,
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1`,
      apiKey: apiToken,
    };
  }

  if (rawProvider === "lovable") {
    const apiKey = env["LOVABLE_API_KEY"]?.trim();
    if (!apiKey) {
      throw new AiConfigurationError(
        "Lovable AI não configurado. Defina LOVABLE_API_KEY no servidor.",
      );
    }

    return {
      provider: "lovable",
      modelId: env["AI_MODEL"]?.trim() || DEFAULT_LOVABLE_AI_MODEL,
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": apiKey },
    };
  }

  throw new AiConfigurationError(
    `Provedor de IA inválido: ${rawProvider}. Use "cloudflare" ou "lovable".`,
  );
}

export function createAiRuntime(env: AiEnvironment = process.env) {
  const config = resolveAiProviderConfig(env);
  const provider = createOpenAICompatible({
    name: `axionn-${config.provider}`,
    baseURL: config.baseURL,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    ...(config.headers ? { headers: config.headers } : {}),
    includeUsage: true,
  });

  return {
    model: provider(config.modelId),
    provider: config.provider,
    modelId: config.modelId,
  };
}
