const SENSITIVE_KEY = /authorization|cookie|token|secret|password|account_number|document|email/i;
const MAX_STRING_LENGTH = 1_000;

export type LogLevel = "info" | "warning" | "error";

export type RequestContext = {
  requestId: string;
  method: string;
  path: string;
  startedAt: number;
};

function sanitize(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (depth > 4) return "[TRUNCATED]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message.slice(0, MAX_STRING_LENGTH),
      stack: value.stack?.split("\n").slice(0, 8).join("\n"),
    };
  }
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, key, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitize(entryValue, entryKey, depth + 1),
      ]),
    );
  }
  return value;
}

export function createRequestContext(request: Request): RequestContext {
  const incoming = request.headers.get("x-request-id")?.trim();
  const requestId =
    incoming && /^[a-zA-Z0-9._-]{8,80}$/.test(incoming) ? incoming : crypto.randomUUID();
  return {
    requestId,
    method: request.method,
    path: new URL(request.url).pathname,
    startedAt: Date.now(),
  };
}

export function logEvent(level: LogLevel, event: string, details: Record<string, unknown> = {}) {
  const sanitizedDetails = sanitize(details) as Record<string, unknown>;
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizedDetails,
  });
  if (level === "error") console.error(payload);
  else if (level === "warning") console.warn(payload);
  else console.info(payload);
}

export function completeRequest(context: RequestContext, status: number) {
  logEvent(status >= 500 ? "error" : status >= 400 ? "warning" : "info", "http.request", {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    status,
    durationMs: Date.now() - context.startedAt,
  });
}

export function withRequestId(response: Response, requestId: string) {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
