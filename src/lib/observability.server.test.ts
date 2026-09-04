import { describe, expect, it, vi } from "vitest";

import { createRequestContext, logEvent } from "./observability.server";

describe("observability", () => {
  it("preserva um request id válido e ignora a query string", () => {
    const request = new Request("https://app.axionn.test/api/health?token=segredo", {
      headers: { "x-request-id": "request-123456" },
    });
    expect(createRequestContext(request)).toMatchObject({
      requestId: "request-123456",
      path: "/api/health",
    });
  });

  it("remove segredos de logs estruturados", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logEvent("info", "test", { token: "segredo", nested: { password: "senha" } });
    const output = String(spy.mock.calls[0]?.[0]);
    expect(output).not.toContain("segredo");
    expect(output).not.toContain("senha");
    expect(output).toContain("[REDACTED]");
    spy.mockRestore();
  });
});
