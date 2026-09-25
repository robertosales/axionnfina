/**
 * Infrastructure Layer - Clientes, adaptadores e integrações
 *
 * Este módulo contém implementações concretas de infraestrutura:
 * - Clientes de banco de dados
 * - Adaptadores de APIs externas
 * - Serviços de observabilidade
 * - Configurações de segurança
 *
 * Regras:
 * - Pode importar de @/domain/ (para usar regras de negócio)
 * - NÃO importa React ou hooks
 * - Implementa interfaces definidas em @/domain/ ou @/application/
 */

// Supabase clients
export { supabase } from "@/integrations/supabase/client";
export { supabaseAdmin } from "@/integrations/supabase/client.server";
export { createUserClient, authenticateApi } from "@/lib/api-auth.server";

// Server client wrapper
export { createClient as createServerClient } from "@/lib/supabase/server";

// Security
export { SECURITY_HEADERS, CSP_HEADER, checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/lib/security";
export { verifyWebhookSecret } from "@/lib/webhook-security";

// Observability
export { logEvent, createRequestContext, withRequestId } from "@/lib/observability.server";

// Open Finance
export { PluggyAdapter } from "@/providers/openfinance/PluggyAdapter";

// AI Provider
export { AiConfigurationError, createAiRuntime } from "@/lib/ai-provider.server";

// Types
export type { Database } from "@/integrations/supabase/types";
