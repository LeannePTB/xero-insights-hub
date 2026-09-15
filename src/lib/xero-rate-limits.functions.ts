import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

/**
 * Per-file Xero quota usage, today and yesterday.
 *
 * Read through the caller's own session: authorisation is
 * public.xero_rate_limit_usage(), which asserts aal2 and super admin itself
 * (Path C platform metadata — our own API usage, not an organisation's data).
 * No admin client, no writes.
 */
export type XeroRateLimitRow = {
  key: string;
  tenantId: string;
  file: string;
  organisation: string;
  day: string;
  dayRemaining: number | null;
  minuteRemaining: number | null;
  appMinuteRemaining: number | null;
  calls: number;
  rejections: number;
  lastProblem: string | null;
  lastRejectedAt: string | null;
  peakHourCalls: number;
  peakHourStart: string | null;
  lastSeen: string;
};

export const listXeroRateLimits = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .handler(async ({ context }): Promise<XeroRateLimitRow[]> => {
    const { data, error } = await (context.supabase as any).rpc("xero_rate_limit_usage");
    if (error) throw new Error("Xero usage unavailable");
    return ((data ?? []) as any[]).map((r) => ({
      key: `${r.tenant_id}:${r.day}`,
      tenantId: r.tenant_id as string,
      file: (r.tenant_name as string | null) ?? (r.tenant_id as string),
      organisation: (r.organisation as string | null) ?? "Unattributed",
      day: r.day as string,
      dayRemaining: (r.day_remaining_low as number | null) ?? null,
      minuteRemaining: (r.min_remaining_low as number | null) ?? null,
      appMinuteRemaining: (r.app_min_remaining_low as number | null) ?? null,
      calls: (r.calls_observed as number) ?? 0,
      rejections: (r.rate_limited_count as number) ?? 0,
      lastProblem: (r.last_problem as string | null) ?? null,
      lastRejectedAt: (r.last_rate_limited_at as string | null) ?? null,
      peakHourCalls: (r.peak_hour_calls as number) ?? 0,
      peakHourStart: (r.peak_hour_start as string | null) ?? null,
      lastSeen: r.last_seen as string,
    }));
  });
