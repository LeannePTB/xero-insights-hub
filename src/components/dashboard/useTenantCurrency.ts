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

/** Shared currency/locale setup; only the fraction-digit setting varies. */
function format(amount: number, currency: string, fractionDigits: number): string {
  const opts: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  };
  try {
    return new Intl.NumberFormat(undefined, opts).format(amount);
  } catch {
    return new Intl.NumberFormat(undefined, { ...opts, currency: "AUD" }).format(amount);
  }
}

/** Rounded to whole units — for analytical/summary figures. */
export function formatMoney(amount: number, currency: string = "AUD"): string {
  return format(amount, currency, 0);
}

/** Two decimal places — for payables, balances and reconciliation differences. */
export function formatMoneyExact(amount: number, currency: string = "AUD"): string {
  return format(amount, currency, 2);
}

