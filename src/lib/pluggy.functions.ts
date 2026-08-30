import { createServerFn } from "@tanstack/react-start";

export const listConnectors = createServerFn({ method: "GET" })
  .inputValidator((input: { search?: string } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { listPluggyConnectors } = await import("./pluggy.server");
    return listPluggyConnectors(data.search);
  });
