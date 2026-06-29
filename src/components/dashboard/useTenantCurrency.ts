import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTenantCurrency } from "@/lib/xero/connections.functions";

/**
 * Resolves the Xero org's base currency (AUD, NZD, USD, ...) so widgets can
 * format money in the actual reporting currency. Cached for 12h per tenant
 * because the base currency only changes if the user re-creates the org.
 *
 * Always returns a string — falls back to "AUD" while loading or on error so
 * formatters never get an empty currency code (which would crash Intl).
 */
export function useTenantCurrency(tenantId: string | undefined): string {
  const fetchCurrency = useServerFn(getTenantCurrency);
  const { data } = useQuery({
    queryKey: ["tenantCurrency", tenantId],
    enabled: !!tenantId,
    staleTime: 12 * 60 * 60 * 1000,
    queryFn: () => fetchCurrency({ data: { tenantId: tenantId! } }),
  });
  return data?.currency ?? "AUD";
}

/** Format a number in the supplied ISO currency, with safe fallbacks. */
export function formatMoney(amount: number, currency: string = "AUD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
