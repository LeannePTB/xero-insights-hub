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
export function pnlPoints(rows: PnlObservation[], today: string) {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const key = new Date(Date.UTC(year, month - 12 + i, 1)).toISOString().slice(0, 7);
    const row = rows.filter(r => r.date.slice(0, 7) === key).sort((a, b) => b.date.localeCompare(a.date))[0];
    return { label: key + (row?.partial ? ' *' : ''), values: [row?.income ?? null, row?.expenses ?? null, row?.profit ?? null] };
  });
}