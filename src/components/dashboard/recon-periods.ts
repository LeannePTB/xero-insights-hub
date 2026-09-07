import { format } from "date-fns";

export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Presets only — a free date picker invites a fetch per keystroke. */
export function periodOptions(): { value: string; label: string }[] {
  const now = new Date();
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const opts = [
    { value: iso(thisMonthEnd), label: `This month end (${format(thisMonthEnd, "d MMM yyyy")})` },
    { value: iso(lastMonthEnd), label: `Last month end (${format(lastMonthEnd, "d MMM yyyy")})` },
  ];
  // The four Australian BAS quarter ends, most recent first.
  const quarters = [
    { m: 8, d: 30 }, // 30 September
    { m: 11, d: 31 }, // 31 December
    { m: 2, d: 31 }, // 31 March
    { m: 5, d: 30 }, // 30 June
  ];
  const ends: Date[] = [];
  for (const y of [now.getFullYear(), now.getFullYear() - 1]) {
    for (const q of quarters) {
      const d = new Date(y, q.m, q.d);
      if (d <= now) ends.push(d);
    }
  }
  ends.sort((a, b) => b.getTime() - a.getTime());
  for (const d of ends.slice(0, 4)) {
    const v = iso(d);
    if (!opts.some((o) => o.value === v)) {
      opts.push({ value: v, label: `Quarter end ${format(d, "d MMM yyyy")}` });
    }
  }
  return opts;
}

/** A GST window: either a calendar month or an Australian BAS quarter. */
export type GstWindowKind = "month" | "quarter";

export type GstPeriodOption = {
  value: string; // `${kind}:${asAt}` — unique per window, never per date alone
  label: string;
  kind: GstWindowKind;
  asAt: string;
  from: string;
  to: string;
};

/** First day of the calendar quarter containing `d` (BAS quarters align to these). */
function quarterStart(d: Date) {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}

/** GST presets. In-progress periods end TODAY, not on a future period end, so
 *  the label can never promise a full month or quarter the figures do not
 *  cover. Completed periods keep their real end dates. */
export function gstPeriodOptions(): GstPeriodOption[] {
  const now = new Date();
  const today = iso(now);

  const opts: GstPeriodOption[] = [];

  // Current month to date.
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  opts.push({
    value: `month:${today}`,
    label: `This month (so far) — ${format(thisMonthStart, "d MMM")} to ${format(now, "d MMM yyyy")}`,
    kind: "month",
    asAt: today,
    from: iso(thisMonthStart),
    to: today,
  });

  // Last completed month.
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
  opts.push({
    value: `month:${iso(lastMonthEnd)}`,
    label: `Last month — ${format(lastMonthStart, "d MMM")} to ${format(lastMonthEnd, "d MMM yyyy")}`,
    kind: "month",
    asAt: iso(lastMonthEnd),
    from: iso(lastMonthStart),
    to: iso(lastMonthEnd),
  });

  // Current BAS quarter to date.
  const thisQuarterStart = quarterStart(now);
  opts.push({
    value: `quarter:${today}`,
    label: `This quarter (so far) — ${format(thisQuarterStart, "d MMM")} to ${format(now, "d MMM yyyy")}`,
    kind: "quarter",
    asAt: today,
    from: iso(thisQuarterStart),
    to: today,
  });

  // The four Australian BAS quarter ends, most recent completed first.
  const quarters = [
    { m: 8, d: 30 }, // 30 September
    { m: 11, d: 31 }, // 31 December
    { m: 2, d: 31 }, // 31 March
    { m: 5, d: 30 }, // 30 June
  ];
  const ends: Date[] = [];
  for (const y of [now.getFullYear(), now.getFullYear() - 1]) {
    for (const q of quarters) {
      const d = new Date(y, q.m, q.d);
      if (d <= now) ends.push(d);
    }
  }
  ends.sort((a, b) => b.getTime() - a.getTime());
  for (const end of ends.slice(0, 4)) {
    const start = quarterStart(end);
    const value = `quarter:${iso(end)}`;
    if (opts.some((o) => o.value === value)) continue;
    opts.push({
      value,
      label: `Quarter — ${format(start, "d MMM")} to ${format(end, "d MMM yyyy")}`,
      kind: "quarter",
      asAt: iso(end),
      from: iso(start),
      to: iso(end),
    });
  }
  return opts;
}

export function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(n);
}
