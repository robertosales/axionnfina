import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listConnectors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { search?: string } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { listPluggyConnectors } = await import("./pluggy.server");
    return listPluggyConnectors(data.search);
  });

export const createConnectToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createPluggyConnectToken } = await import("./pluggy.server");
    return { connectToken: await createPluggyConnectToken(context.userId) };
  });

export const completeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { institutionId: string; itemId: string }) => input)
  .handler(async ({ data, context }) => {
    const { registerPluggyConnection } = await import("./openfinance-sync.server");
    return registerPluggyConnection(
      context.supabase,
      context.userId,
      data.institutionId,
      data.itemId,
    );
  });

export const syncConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { connectionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { syncPluggyConnection } = await import("./openfinance-sync.server");
    return syncPluggyConnection(context.supabase, context.userId, data.connectionId);
  });

export const revokeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { connectionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { revokePluggyConnection } = await import("./openfinance-sync.server");
    await revokePluggyConnection(context.supabase, context.userId, data.connectionId);
    return { success: true };
  });
