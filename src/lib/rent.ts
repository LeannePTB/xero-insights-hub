// Rent received per rental property, matched from stored Xero receipts.
// Pure: no Xero, no database. Matching uses Xero IDs only, never names.

export type RentFrequency = "weekly" | "fortnightly" | "monthly";
export type RentMatchType = "account" | "tracking" | "contact";

export type RentalPropertyConfig = {
  matchType: RentMatchType;
  matchIds: string[];
  expectedAmount: number;
  frequency: RentFrequency;
  leaseStart: string | null;
};

export type RentReceipt = { date: string; amount: number };

export type RentStatus = "ahead" | "due" | "arrears" | "no_rent";

export type RentPosition = {
  lastPaidDate: string | null;
  lastPaidAmount: number | null;
  paidUpTo: string | null;
  status: RentStatus;
  arrearsAmount: number;
  daysBehind: number;
  receivedThisMonth: number;
  received12Months: number;
};

const DAY = 86_400_000;

/** Xero dates arrive as `/Date(1696118400000+0000)/` or ISO strings. */
export function xeroDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const m = /\/Date\((-?\d+)/.exec(value);
  const d = m ? new Date(Number(m[1])) : new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toMs(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}
function fromMs(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addPeriods(start: string, periods: number, frequency: RentFrequency): string {
  if (frequency !== "monthly") {
    const days = frequency === "weekly" ? 7 : 14;
    return fromMs(toMs(start) + Math.round(periods * days) * DAY);
  }
  const whole = Math.floor(periods);
  const d = new Date(toMs(start));
  d.setUTCMonth(d.getUTCMonth() + whole);
  const next = new Date(d);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const frac = periods - whole;
  return fromMs(d.getTime() + Math.round(((next.getTime() - d.getTime()) / DAY) * frac) * DAY);
}

function periodsBetween(start: string, end: string, frequency: RentFrequency): number {
  if (toMs(end) <= toMs(start)) return 0;
  if (frequency !== "monthly") {
    const days = frequency === "weekly" ? 7 : 14;
    return (toMs(end) - toMs(start)) / DAY / days;
  }
  const s = new Date(toMs(start));
  const e = new Date(toMs(end));
  let months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  if (addPeriods(start, months, "monthly") > end) months -= 1;
  const base = addPeriods(start, months, "monthly");
  const nextBase = addPeriods(start, months + 1, "monthly");
  return months + (toMs(end) - toMs(base)) / (toMs(nextBase) - toMs(base));
}

function lineMatches(line: any, cfg: RentalPropertyConfig, accountIdByCode: Map<string, string>) {
  if (cfg.matchType === "account") {
    const id = line?.AccountID ?? (line?.AccountCode ? accountIdByCode.get(String(line.AccountCode)) : undefined);
    return typeof id === "string" && cfg.matchIds.includes(id);
  }
  if (cfg.matchType === "tracking") {
    return (line?.Tracking ?? []).some(
      (t: any) => typeof t?.TrackingOptionID === "string" && cfg.matchIds.includes(t.TrackingOptionID),
    );
  }
  return false;
}

function lineTotal(line: any, amountTypes: unknown) {
  const amount = Number(line?.LineAmount ?? 0);
  const tax = amountTypes === "Exclusive" ? Number(line?.TaxAmount ?? 0) : 0;
  return (Number.isFinite(amount) ? amount : 0) + (Number.isFinite(tax) ? tax : 0);
}

/** Receipts for one property from stored bank receipts and paid invoices. */
export function matchRentReceipts(
  cfg: RentalPropertyConfig,
  bankTransactions: any[],
  paidInvoices: any[],
  accountIdByCode: Map<string, string> = new Map(),
): RentReceipt[] {
  const out: RentReceipt[] = [];
  const consider = (doc: any, date: string | null) => {
    if (!date) return;
    if (cfg.matchType === "contact") {
      const cid = doc?.Contact?.ContactID;
      if (typeof cid === "string" && cfg.matchIds.includes(cid)) {
        const total = Number(doc?.Total ?? 0);
        if (total > 0) out.push({ date, amount: total });
      }
      return;
    }
    const amount = (doc?.LineItems ?? [])
      .filter((l: any) => lineMatches(l, cfg, accountIdByCode))
      .reduce((s: number, l: any) => s + lineTotal(l, doc?.LineAmountTypes), 0);
    if (amount > 0) out.push({ date, amount: Math.round(amount * 100) / 100 });
  };
  for (const t of bankTransactions) consider(t, xeroDate(t?.DateString) ?? xeroDate(t?.Date));
  for (const inv of paidInvoices) consider(inv, xeroDate(inv?.FullyPaidOnDate) ?? xeroDate(inv?.DateString));
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Where a property's rent stands today. `windowStart` is the earliest date the
 * stored receipts cover: payments before it are not visible, so counting
 * starts there rather than inventing arrears from an older lease.
 */
export function rentPosition(
  cfg: RentalPropertyConfig,
  receipts: RentReceipt[],
  today: string,
  windowStart: string,
): RentPosition {
  const monthStart = `${today.slice(0, 7)}-01`;
  const yearAgo = fromMs(toMs(today) - 365 * DAY);
  const receivedThisMonth = receipts.filter((r) => r.date >= monthStart && r.date <= today).reduce((s, r) => s + r.amount, 0);
  const received12Months = receipts.filter((r) => r.date > yearAgo && r.date <= today).reduce((s, r) => s + r.amount, 0);
  const latest = receipts[0] ?? null;
  const base = {
    lastPaidDate: latest?.date ?? null,
    lastPaidAmount: latest?.amount ?? null,
    receivedThisMonth: round2(receivedThisMonth),
    received12Months: round2(received12Months),
  };
  if (receipts.length === 0) {
    return { ...base, paidUpTo: null, status: "no_rent", arrearsAmount: 0, daysBehind: 0 };
  }
  const earliest = receipts[receipts.length - 1]!.date;
  let start = cfg.leaseStart ?? earliest;
  if (start < windowStart) start = windowStart;
  const counted = receipts.filter((r) => r.date >= start).reduce((s, r) => s + r.amount, 0);
  const periodsPaid = counted / cfg.expectedAmount;
  const paidUpTo = addPeriods(start, periodsPaid, cfg.frequency);
  const elapsed = periodsBetween(start, today, cfg.frequency);
  const owingPeriods = elapsed - periodsPaid;
  const daysBehind = Math.max(0, Math.round((toMs(today) - toMs(paidUpTo)) / DAY));
  let status: RentStatus;
  if (paidUpTo >= today) status = "ahead";
  else if (owingPeriods <= 1) status = "due";
  else status = "arrears";
  return {
    ...base,
    paidUpTo,
    status,
    arrearsAmount: status === "ahead" ? 0 : round2(Math.max(0, owingPeriods) * cfg.expectedAmount),
    daysBehind: status === "ahead" ? 0 : daysBehind,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
