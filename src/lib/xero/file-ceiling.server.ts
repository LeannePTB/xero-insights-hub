// Per-file hourly ceiling on outbound Xero calls.
//
// Xero's own limits (60/minute, 5,000/day per file, 5 concurrent) only tell us
// after the fact, and the burst check only reports afterwards. This is a hard
// local stop: no single Xero organisation may exceed XERO_FILE_HOUR_CEILING
// outbound calls in a fixed UTC-aligned hour, whatever asks for them —
// interactive dashboard loads, snapshot refreshes, reconcile, retries.
//
// Normal use for a file is 12–14 calls a day, and a full manual refresh is
// about 40. The ceiling is deliberately far above ordinary work so it never
// interrupts real use, and far below Xero's daily allowance so a runaway caller
// is stopped long before a file loses its quota.
//
// The counter is public.rate_limit_buckets via the service-role definer
// public.check_rate_limit, so it holds across every backend instance (the
// earlier in-process throttle did not).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Raised from 200: one person working through one client's settings reached
// 200 in under an hour. 1,500/hour still stops a runaway caller well inside
// Xero's 5,000/day; Xero's real 60/minute and 5-concurrent limits are enforced
// by the request gate in api.server.ts.
export const XERO_FILE_HOUR_CEILING = 1500;

// Our own hold, not a Xero refusal: the same wording as the request gate, so
// the UI waits and retries instead of blaming Xero.
export const XERO_FILE_CEILING_MESSAGE = "Waiting for Xero — loading shortly.";

/**
 * Count one outbound call for `tenantId` and refuse it when the file has
 * already used its hourly ceiling.
 *
 * Fails open if the limiter itself errors — consistent with enforceRateLimit;
 * a broken counter must not black out every client's data. Xero's own limits
 * remain the backstop in that case.
 */
export async function enforceXeroFileCeiling(tenantId: string | null | undefined): Promise<void> {
  if (!tenantId) return;
  const { data, error } = await (supabaseAdmin.rpc as any)("check_rate_limit", {
    _key: `xero_file_hour:${tenantId}`,
    _max: XERO_FILE_HOUR_CEILING,
    _window_seconds: 3600,
  });
  if (error) {
    console.warn("[xero] file ceiling check failed", error.message);
    return;
  }
  if (data === false) {
    console.error(`[xero] hourly file ceiling reached for tenant ${tenantId}`);
    throw new Error(XERO_FILE_CEILING_MESSAGE);
  }
}
