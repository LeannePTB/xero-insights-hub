// Pure helpers for the one-off month-end history backfill (no I/O).

/** The last `count` completed month-ends before `today` (YYYY-MM-DD), oldest first. */
export function completedMonthEnds(today: string, count = 12): string[] {
  const [y, m] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = count; i >= 1; i--) out.push(new Date(Date.UTC(y, m - 1 - i + 1, 0)).toISOString().slice(0, 10));
  return out;
}

export type HistoryPoint = { client_id: string; tenant_id: string; as_at: string; cash: number | null; source: "daily" | "month_end" };

/**
 * Merge nightly rows with backfilled month-end rows. A nightly row always wins
 * on the same client, file and date; a backfilled row never replaces it.
 */
export function mergeHistory(
  daily: { client_id: string; tenant_id: string; as_at: string; cash: number | null; protected_money?: number | null }[],
  monthEnd: { client_id: string; tenant_id: string; month_end: string; cash: number | null }[],
) {
  const seen = new Set(daily.map((r) => `${r.client_id}:${r.tenant_id}:${r.as_at}`));
  const merged = daily.map((r) => ({ ...r, source: "daily" as const }));
  for (const r of monthEnd) {
    const k = `${r.client_id}:${r.tenant_id}:${r.month_end}`;
    if (seen.has(k) || r.cash === null) continue;
    seen.add(k);
    merged.push({ client_id: r.client_id, tenant_id: r.tenant_id, as_at: r.month_end, cash: r.cash, protected_money: null, source: "month_end" as const } as any);
  }
  return merged.sort((a, b) => a.as_at.localeCompare(b.as_at));
}

/** Retry policy: rate limits resume later; anything else stops after 5 tries. */
export function nextAttempt(kind: "rate_limited" | "error", attempts: number, now = Date.now()) {
  if (kind === "error" && attempts >= 5) return null;
  const minutes = kind === "rate_limited" ? 15 : Math.min(60, 5 * 2 ** attempts);
  return new Date(now + minutes * 60_000).toISOString();
}
