import { addDays, sydneyDate } from "@/lib/sydney-time";

const dateValue = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
    throw new Error("Invalid payday date");
  }
  return d;
};

/** Gregorian Easter Sunday, computed as date-only UTC arithmetic. */
function easterSunday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return new Date(Date.UTC(year, Math.floor(n / 31) - 1, n % 31 + 1)).toISOString().slice(0, 10);
}

/** National dates only; state-specific holidays/substitute ANZAC days are not inferred. */
export function nationalPublicHolidays(year: number): Set<string> {
  const fixed = [`${year}-01-01`, `${year}-01-26`, `${year}-04-25`, `${year}-12-25`, `${year}-12-26`];
  const holidays = new Set(fixed);
  for (const iso of fixed.filter((x) => !x.endsWith("04-25"))) {
    const day = dateValue(iso).getUTCDay();
    if (day === 6 || day === 0) {
      let substitute = addDays(iso, day === 6 ? 2 : 1);
      while (holidays.has(substitute)) substitute = addDays(substitute, 1);
      holidays.add(substitute);
    }
  }
  const easter = easterSunday(year);
  holidays.add(addDays(easter, -2));
  holidays.add(addDays(easter, 1));
  return holidays;
}

export function paydaySuperDueDate(payday: string): string {
  dateValue(payday);
  let cursor = payday, counted = 0;
  while (counted < 7) {
    cursor = addDays(cursor, 1);
    const d = dateValue(cursor);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !nationalPublicHolidays(d.getUTCFullYear()).has(cursor)) counted++;
  }
  return cursor;
}

export function paydaySuperStatus(due: string, today = sydneyDate()): { text: string; overdue: boolean } {
  const days = Math.round((dateValue(due).getTime() - dateValue(today).getTime()) / 86400000);
  return { text: days === 0 ? "Due today" : days > 0 ? `Due in ${days} days` : `Overdue by ${-days} days`, overdue: days < 0 };
}
/**
 * Exceptions only, shown beside the due date of an UNPAID payday: "Overdue"
 * once the due date has passed, "Due today" on the day, otherwise nothing.
 */
export function paydaySuperFlag(due: string, today = sydneyDate()): "Overdue" | "Due today" | null {
  if (due < today) return "Overdue";
  if (due === today) return "Due today";
  return null;
}

export type SgQuarterRow = { label: string; from: string; to: string; due: string; superFromPayRuns: number; current: boolean };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Super from pay runs (by payment date) for the last finished SG quarter and
 * the current one, oldest first. Quarterly SG due date: the 28th of the month
 * after the quarter ends (Jul–Sep → 28 Oct, Oct–Dec → 28 Jan). Never a payment.
 */
export function sgQuarterRows(today: string, runs: { paymentDate: string | null; super: number }[]): SgQuarterRow[] {
  dateValue(today);
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const q0 = Math.floor((m - 1) / 3) * 3; // 0-based start month of current quarter
  const quarter = (year: number, startMonth: number, current: boolean): SgQuarterRow => {
    const from = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(year, startMonth + 3, 0)).toISOString().slice(0, 10);
    const dueY = startMonth === 9 ? year + 1 : year;
    const dueM = (startMonth + 3) % 12;
    const due = `${dueY}-${String(dueM + 1).padStart(2, "0")}-28`;
    const total = runs.filter((r) => r.paymentDate && r.paymentDate >= from && r.paymentDate <= end).reduce((s, r) => s + (r.super || 0), 0);
    return { label: `${MONTHS[startMonth]}–${MONTHS[startMonth + 2]} ${year}`, from, to: end, due, superFromPayRuns: Math.round(total * 100) / 100, current };
  };
  const prev = q0 === 0 ? quarter(y - 1, 9, false) : quarter(y, q0 - 3, false);
  return [prev, quarter(y, q0, true)];
}
