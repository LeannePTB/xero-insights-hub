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

/** GST presets. Monthly options behave exactly as before; the quarter options
 *  now describe a genuine three-month window, not a month wearing a quarter's
 *  label. */
export function gstPeriodOptions(): GstPeriodOption[] {
  const now = new Date();
  const monthEnds = [
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
    new Date(now.getFullYear(), now.getMonth(), 0),
  ];
  const opts: GstPeriodOption[] = monthEnds.map((end, i) => {
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      value: `month:${iso(end)}`,
      label: `${i === 0 ? "This month" : "Last month"} — ${format(start, "d MMM")} to ${format(end, "d MMM yyyy")}`,
      kind: "month" as const,
      asAt: iso(end),
      from: iso(start),
      to: iso(end),
    };
  });

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
  for (const end of ends.slice(0, 4)) {
    const start = quarterStart(end);
    opts.push({
      value: `quarter:${iso(end)}`,
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
