/** Standard chart transformations. Missing observations are never zero-filled. */
export type PnlObservation = { date: string; income: number | null; expenses: number | null; profit: number | null; partial: boolean; source: string; basis?: string };
export function ageingPoints(invoices: { daysOverdue: number; amountDue: number }[]) {
  const amounts = [0, 0, 0, 0, 0];
  for (const i of invoices) {
    if (!Number.isFinite(i.amountDue) || i.amountDue <= 0) continue;
    const bucket = i.daysOverdue <= 0 ? 0 : i.daysOverdue <= 30 ? 1 : i.daysOverdue <= 60 ? 2 : i.daysOverdue <= 90 ? 3 : 4;
    amounts[bucket] += i.amountDue;
  }
  return ['Current', '1–30', '31–60', '61–90', '90+'].map((label, i) => ({ label, values: [amounts[i]] }));
}
/** Australian financial year containing `today` (YYYY-MM-DD): 1 July start and "FY26–27" label. */
export function financialYear(today: string) {
  const [y, m] = today.split('-').map(Number);
  const start = m >= 7 ? y : y - 1;
  const yy = (n: number) => String(n % 100).padStart(2, '0');
  return { from: `${start}-07-01`, label: `FY${yy(start)}–${yy(start + 1)}`, months: (m >= 7 ? m - 7 : m + 5) + 1 };
}
/** July → current month of the current financial year; current month marked partial. */
export function pnlPoints(rows: PnlObservation[], today: string) {
  const fy = financialYear(today);
  const [sy] = fy.from.split('-').map(Number);
  const current = today.slice(0, 7);
  return Array.from({ length: fy.months }, (_, i) => {
    const key = new Date(Date.UTC(sy, 6 + i, 1)).toISOString().slice(0, 7);
    const row = rows.filter(r => r.date.slice(0, 7) === key).sort((a, b) => b.date.localeCompare(a.date))[0];
    const partial = key === current || !!row?.partial;
    return { label: key + (partial ? ' *' : ''), values: [row?.income ?? null, row?.expenses ?? null, row?.profit ?? null] };
  });
}
