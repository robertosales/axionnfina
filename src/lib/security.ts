/**
 * Security Headers — CSP, rate limiting e outras configs de segurança.
 * Este arquivo é referenciado pelo server entry do TanStack Start.
 */

/** Content Security Policy */
export const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openfinancebrasil.org.br",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** Headers de segurança para todas as respostas */
export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP_HEADER,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/* ------------------------------------------------------------------ */
/* Rate Limiting (in-memory, para Edge Functions)                      */
/* ------------------------------------------------------------------ */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Verifica rate limiting simples em memória.
 * @param key - Chave única (ex: userId + endpoint)
 * @param maxRequests - Máximo de requisições no janela
 * @param windowMs - Janela em milissegundos
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Limpar entradas expiradas periodicamente
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore) {
      if (v.resetAt < now) rateLimitStore.delete(k);
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/** Rate limites pré-configurados */
export const RATE_LIMITS = {
  /** Chat com agente: 10 req/min por usuário */
  agentChat: { maxRequests: 10, windowMs: 60_000 },
  /** Sincronização de transações: 30 req/min por usuário */
  transactionSync: { maxRequests: 30, windowMs: 60_000 },
  /** Login: 5 tentativas/min por IP */
  login: { maxRequests: 5, windowMs: 60_000 },
  /** API geral: 60 req/min por usuário */
  api: { maxRequests: 60, windowMs: 60_000 },
} as const;

/** Aplica rate limit e retorna headers de resposta */
export function getRateLimitHeaders(
  key: string,
  config: { maxRequests: number; windowMs: number },
): {
  allowed: boolean;
  headers: Record<string, string>;
} {
  const result = checkRateLimit(key, config.maxRequests, config.windowMs);
  return {
    allowed: result.allowed,
    headers: {
      "X-RateLimit-Limit": String(config.maxRequests),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      ...(result.allowed ? {} : { "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)) }),
    },
  };
}
