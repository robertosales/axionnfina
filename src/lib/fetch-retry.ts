/** Retry only safe reads, with bounded latency; never replay a mutation. */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  request: typeof fetch = fetch,
): Promise<Response> {
  const attempts = (init.method ?? "GET").toUpperCase() === "GET" ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await request(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
    if (![429, 502, 503, 504].includes(response.status) || attempt === attempts - 1)
      return response;
    await response.body?.cancel();
    const retryAfter = Number(response.headers.get("Retry-After"));
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(3000, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt)),
    );
  }
  throw new Error("Request failed");
}
