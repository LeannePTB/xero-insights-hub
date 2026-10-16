/**
 * Pure helpers for Trixie's organisation-level answers. No I/O and no access
 * logic: the client list passed in is ALREADY the caller-scoped list returned by
 * the database (overview_clients via buildOverview), so these functions can only
 * ever narrow it, never widen it.
 */

export type AccessibleClient = { clientId: string; clientName: string; firmId: string; firmName: string };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const STOP = new Set(["pty", "ltd", "limited", "the", "and", "co", "group", "trust", "trading"]);

/** Case-insensitive, partial match of a typed name against accessible clients only. */
export function resolveClientName(clients: AccessibleClient[], typed: string): AccessibleClient[] {
  const q = norm(typed);
  if (q.length < 2) return [];
  const exact = clients.filter((c) => norm(c.clientName) === q);
  if (exact.length) return exact;
  const partial = clients.filter((c) => norm(c.clientName).includes(q) || q.includes(norm(c.clientName)));
  if (partial.length) return partial;
  const words = q.split(" ").filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return [];
  return clients.filter((c) => {
    const name = norm(c.clientName);
    return words.every((w) => name.includes(w));
  });
}

/** The organisation's own business, when it is also one of its clients (same name). */
export function ownBusinessClient(clients: AccessibleClient[], firmId: string | null): AccessibleClient | null {
  if (!firmId) return null;
  return clients.find((c) => c.firmId === firmId && norm(c.clientName) === norm(c.firmName)) ?? null;
}

function parseDate(s: unknown): Date | null {
  if (typeof s !== "string" || !s) return null;
  const m = /\/Date\((-?\d+)/.exec(s);
  const d = m ? new Date(Number(m[1])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Overdue receivables from saved open invoices: total, over 90 days, top 3 overdue customers. */
export function overdueSummary(invoices: any[], today = new Date()) {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  let overdue = 0;
  let over90 = 0;
  const byCustomer = new Map<string, number>();
  for (const inv of invoices ?? []) {
    const amount = Number(inv?.AmountDue) || 0;
    if (amount <= 0) continue;
    const due = parseDate(inv?.DueDate);
    if (!due) continue;
    const days = Math.floor((t.getTime() - due.getTime()) / 86_400_000);
    if (days <= 0) continue;
    overdue += amount;
    if (days > 90) over90 += amount;
    const name = String(inv?.Contact?.Name ?? "Unknown").slice(0, 80);
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + amount);
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    overdueTotal: r(overdue),
    over90Days: r(over90),
    topOverdue: [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, amount]) => ({ name, amount: r(amount) })),
  };
}
