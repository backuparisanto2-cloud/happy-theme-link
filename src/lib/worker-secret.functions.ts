import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWorkerSecretStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { readSecretStatus } = await import("@/lib/worker-secret.server");
    return readSecretStatus();
  });

export const applyWorkerSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode: "generate" | "manual"; secret?: string }) => ({
    mode: input.mode === "manual" ? ("manual" as const) : ("generate" as const),
    secret: typeof input.secret === "string" ? input.secret : undefined,
  }))
  .handler(async ({ data }) => {
    const { writeSecretEverywhere } = await import("@/lib/worker-secret.server");
    return writeSecretEverywhere(data.mode === "manual" ? data.secret : undefined);
  });