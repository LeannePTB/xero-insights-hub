// Per-client attention counts for the Client overview. Counts clients, never
// sums figures across clients: unrelated companies' money is not added together.
import type { OverviewRow } from "./overview.functions";

export type AttentionKey = "cash_below_owed" | "overdrawn" | "overdue_receivables" | "out_of_date";

export const ATTENTION: { key: AttentionKey; label: string }[] = [
  { key: "cash_below_owed", label: "Cash below what's owed" },
  { key: "overdrawn", label: "Overdrawn" },
  { key: "overdue_receivables", label: "Overdue receivables" },
  { key: "out_of_date", label: "Figures out of date" },
];

const DAY = 86_400_000;

type Row = Pick<OverviewRow, "cash" | "protectedMoney" | "debtorsOver60" | "freshAsAt" | "xeroNeedsAttention">;

export function matchesAttention(r: Row, key: AttentionKey, now = Date.now()): boolean {
  switch (key) {
    case "cash_below_owed":
      return r.cash != null && r.protectedMoney != null && r.protectedMoney > 0 && r.protectedMoney > r.cash;
    case "overdrawn":
      return r.cash != null && r.cash < 0;
    case "overdue_receivables":
      return r.debtorsOver60 != null && r.debtorsOver60 > 0;
    case "out_of_date":
      return !!r.xeroNeedsAttention || !r.freshAsAt || now - new Date(r.freshAsAt).getTime() > 2 * DAY;
  }
}

export function attentionCounts(rows: Row[], now = Date.now()): Record<AttentionKey, number> {
  const out = { cash_below_owed: 0, overdrawn: 0, overdue_receivables: 0, out_of_date: 0 };
  for (const r of rows) for (const a of ATTENTION) if (matchesAttention(r, a.key, now)) out[a.key]++;
  return out;
}
