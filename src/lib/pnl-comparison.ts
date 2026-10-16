/** Same days of the previous month; a whole month compares with the whole previous month. */
export function sameDaysPreviousMonth(from: Date, to: Date): { from: Date; to: Date } {
  const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const shift = (d: Date) => new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), lastDay(d.getFullYear(), d.getMonth() - 1)));
  const toIsMonthEnd = to.getDate() === lastDay(to.getFullYear(), to.getMonth());
  const priorTo = toIsMonthEnd ? new Date(to.getFullYear(), to.getMonth(), 0) : shift(to);
  return { from: shift(from), to: priorTo };
}

/** Note shown only when both counts are known and differ. */
export function paydayNote(current: number | null, prior: number | null): string | null {
  if (current === null || prior === null || current === prior) return null;
  const n = (k: number) => `${k} payday${k === 1 ? "" : "s"}`;
  return `${n(current)} this period vs ${prior} in the comparison — wages and super aren't like for like.`;
}
