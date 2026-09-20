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

export const XERO_FILE_HOUR_CEILING = 200;

export const XERO_FILE_CEILING_MESSAGE =
  "Xero has paused requests for this organisation because too many were sent in the last hour. Figures already saved still show. Try again shortly.";

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
