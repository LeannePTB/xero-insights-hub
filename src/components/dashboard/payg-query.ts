// One cache entry per Xero file for the PAYG position. The server function
// reads Xero live (Balance Sheet + Accounts), so every widget that shows PAYG
// must share this key and these limits — otherwise each card, remount and
// window focus becomes another pair of Xero calls.
export const PAYG_STALE_TIME_MS = 30 * 60 * 1000;

export function paygQueryKey(tenantId: string, clientId?: string | null) {
  return ["xero-payg-withholding", tenantId, clientId ?? null] as const;
}

export const paygQueryLimits = {
  retry: false,
  staleTime: PAYG_STALE_TIME_MS,
  gcTime: PAYG_STALE_TIME_MS,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
