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

export function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(n);
}
