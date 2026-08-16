import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Database client for worker/cron endpoints.
 *
 * - Hosted on Lovable Cloud: uses the service-role client (bypasses RLS).
 * - Self-hosted (Windows / any Node host): the service-role key is not
 *   available, so it signs in with a service account (the owner's login) and
 *   works under that user's RLS scope.
 */

type Db = SupabaseClient<Database>;

let cachedClient: Db | undefined;
let cachedExpiresAt = 0;

function newKeyFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export async function getServiceDb(): Promise<Db> {
  if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin as unknown as Db;
  }

  const now = Date.now();
  if (cachedClient && cachedExpiresAt - now > 60_000) return cachedClient;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const email = process.env["SERVICE_ACCOUNT_EMAIL"];
  const password = process.env["SERVICE_ACCOUNT_PASSWORD"];

  if (!url || !key || !email || !password) {
    throw new Error(
      "Missing env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SERVICE_ACCOUNT_EMAIL, SERVICE_ACCOUNT_PASSWORD",
    );
  }

  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: newKeyFetch(key) },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Service account sign-in failed: ${error?.message ?? "no session"}`);
  }

  cachedClient = client;
  cachedExpiresAt = (data.session.expires_at ?? Math.floor(now / 1000) + 3600) * 1000;
  return client;
}

/** Shared secret guard for worker endpoints (pull/status). */
export function checkWorkerSecret(request: Request): boolean {
  const secret = process.env["WHATSAPP_WORKER_SECRET"];
  return Boolean(secret) && request.headers.get("x-worker-secret") === secret;
}

/** Guard for the scheduler endpoint: worker secret or the cron key. */
export function checkSchedulerSecret(request: Request): boolean {
  if (checkWorkerSecret(request)) return true;
  const cronSecret = process.env["CRON_SECRET"];
  return Boolean(cronSecret) && request.headers.get("x-cron-secret") === cronSecret;
}