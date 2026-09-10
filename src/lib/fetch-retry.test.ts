import { expect, it, vi } from "vitest";
import { fetchWithRetry } from "./fetch-retry";
it("repete leitura temporariamente indisponível", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValue(new Response("ok"));
  expect((await fetchWithRetry("https://example.test", {}, request)).status).toBe(200);
  expect(request).toHaveBeenCalledTimes(2);
});
it("não repete mutações ou erros de autorização", async () => {
  const request = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  expect((await fetchWithRetry("https://example.test", { method: "POST" }, request)).status).toBe(
    503,
  );
  expect(request).toHaveBeenCalledTimes(1);
  request.mockResolvedValue(new Response(null, { status: 401 }));
  await fetchWithRetry("https://example.test", {}, request);
  expect(request).toHaveBeenCalledTimes(2);
});
