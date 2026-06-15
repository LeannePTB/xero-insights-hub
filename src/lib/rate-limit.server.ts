// Server-only rate limit helper. Backed by public.check_rate_limit (Postgres).
// Throws a user-facing Error when the limit is hit.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function enforceRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<void> {
  const { data, error } = await (supabaseAdmin.rpc as any)("check_rate_limit", {
    _key: key,
    _max: max,
    _window_seconds: windowSeconds,
  });
  if (error) {
    // Fail open on infra errors — don't lock users out if the limiter is down.
    console.warn("rate_limit_check_failed", { key, error: error.message });
    return;
  }
  if (data === false) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }
}
