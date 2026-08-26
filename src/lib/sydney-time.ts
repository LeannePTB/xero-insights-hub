// The one place the application's timezone is defined.
//
// Every date this feature derives — as-at dates, period starts and ends,
// month-end boundaries, the `as_at` column on a snapshot — is a Sydney date.
// It must never come from `new Date().toISOString().slice(0, 10)`: the
// scheduled refresh runs at 3am Sydney, which is 16:00 or 17:00 the PREVIOUS
// UTC day, so a UTC-derived date is off by one — and on the 1st of the month
// it silently pulls the previous month's month-end.
//
// Sydney is UTC+10 in winter and UTC+11 during daylight saving. Nothing here
// hardcodes an offset; `Intl` resolves it per instant.

export const APP_TIME_ZONE = "Australia/Sydney";

/**
 * The single date helper. Returns the calendar date in Sydney for an instant,
 * as `YYYY-MM-DD`. Every other function in this module is built on it.
 */
export function sydneyDate(instant: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is the ISO calendar date we want.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** The hour of the day (0-23) in Sydney. Used only for logging/diagnostics. */
export function sydneyHour(instant: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      hour12: false,
    }).format(instant),
  );
}

/** Split a `YYYY-MM-DD` into its numeric parts. */
function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** First day of the month containing `date`. */
export function startOfMonth(date: string): string {
  const { y, m } = parts(date);
  return `${y}-${pad(m)}-01`;
}

/** Last day of the month containing `date`. */
export function endOfMonth(date: string): string {
  const { y, m } = parts(date);
  // Day 0 of the next month is the last day of this one. Computed in UTC on
  // purpose: these are calendar arithmetic on an already-Sydney date, not a
  // conversion, so no timezone is involved.
  const last = new Date(Date.UTC(y, m, 0));
  return `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`;
}

/** Shift a `YYYY-MM-DD` by whole months, clamped to the end of the month. */
export function addMonths(date: string, months: number): string {
  const { y, m, d } = parts(date);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return `${ty}-${pad(tm)}-${pad(Math.min(d, lastDay))}`;
}

/** Shift a `YYYY-MM-DD` by whole days. */
export function addDays(date: string, days: number): string {
  const { y, m, d } = parts(date);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Start of the financial year (1 July, Australian) containing `date`. */
export function startOfFinancialYear(date: string): string {
  const { y, m } = parts(date);
  return m >= 7 ? `${y}-07-01` : `${y - 1}-07-01`;
}

/**
 * Convert a Sydney calendar date (`YYYY-MM-DD`) to the instant at which that
 * day starts in Sydney.
 *
 * The offset is resolved per date by asking `Intl` what Sydney's wall clock
 * reads at a candidate instant, so it is +10:00 in winter and +11:00 during
 * daylight saving without anything hardcoded.
 */
export function sydneyStartOfDay(date: string): Date {
  const { y, m, d } = parts(date);
  // First guess: treat the wall time as UTC, then correct by the offset that
  // actually applies at that instant. One correction is enough because the
  // offset only changes at 2-3am on two days a year and midnight is outside
  // the ambiguous window in Sydney.
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offsetMinutes = sydneyOffsetMinutes(new Date(guess));
  return new Date(guess - offsetMinutes * 60_000);
}

/** The same instant as an ISO string, for writing to `timestamptz` columns. */
export function sydneyStartOfDayISO(date: string): string {
  return sydneyStartOfDay(date).toISOString();
}

/** Sydney's UTC offset, in minutes, at a given instant. */
export function sydneyOffsetMinutes(instant: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(instant);
  const name = formatted.find((p) => p.type === "timeZoneName")?.value ?? "GMT+10:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 600;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}
