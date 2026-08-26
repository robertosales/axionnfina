import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Cria o provider do Lovable AI Gateway (compatível com a API OpenAI).
 * A chave nunca é exposta ao browser — este módulo é server-only.
 */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}
