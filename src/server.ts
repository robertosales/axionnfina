import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  completeRequest,
  createRequestContext,
  logEvent,
  withRequestId,
} from "./lib/observability.server";
import { SECURITY_HEADERS, checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "./lib/security";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function applyRateLimiting(request: Request): Record<string, string> {
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
  const path = new URL(request.url).pathname;
  const config = path.startsWith("/auth") ? RATE_LIMITS.login : RATE_LIMITS.api;
  const key = `${path.startsWith("/auth") ? "login" : "api"}:${ip}`;
  const result = checkRateLimit(key, config.maxRequests, config.windowMs);
  return getRateLimitHeaders(key, config).headers;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const requestContext = createRequestContext(request);
    try {
      const rateLimitHeaders = applyRateLimiting(request);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      const secured = applySecurityHeaders(normalized);
      const finalHeaders = { ...rateLimitHeaders, ...Object.fromEntries(secured.headers) };
      const finalResponse = new Response(secured.body, {
        status: secured.status,
        statusText: secured.statusText,
        headers: finalHeaders,
      });
      completeRequest(requestContext, finalResponse.status);
      return withRequestId(finalResponse, requestContext.requestId);
    } catch (error) {
      logEvent("error", "http.unhandled", { requestId: requestContext.requestId, error });
      const response = new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
      completeRequest(requestContext, response.status);
      return withRequestId(response, requestContext.requestId);
    }
  },
};
