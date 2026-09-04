import { createFileRoute } from "@tanstack/react-router";

import { validateRuntimeConfig } from "@/lib/runtime-config.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const checks = validateRuntimeConfig();
        const ready = checks.every((check) => check.ok);
        return Response.json(
          {
            status: ready ? "ready" : "degraded",
            timestamp: new Date().toISOString(),
            checks: checks.map(({ name, ok, message }) => ({ name, ok, message })),
          },
          {
            status: ready ? 200 : 503,
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
