// One freshness line for every live dashboard card: what period the figures
// cover, and when they were last pulled from Xero. Presentation only — it
// never computes or alters a figure.

function fmtDay(d: Date) {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

function parseDay(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v.length === 10 ? `${v}T00:00:00` : v) : v;
  return isNaN(d.getTime()) ? null : d;
}

export function formatCoverage(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined,
): string | null {
  const f = parseDay(from);
  const t = parseDay(to);
  if (f && t) {
    const sameYear = f.getFullYear() === t.getFullYear();
    const left = sameYear
      ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(f)
      : fmtDay(f);
    return `Covering ${left} to ${fmtDay(t)}`;
  }
  if (t) return `As at ${fmtDay(t)}`;
  return null;
}

export function formatPulled(at: number | string | null | undefined): string {
  if (!at) return "not pulled yet";
  const then = typeof at === "number" ? at : new Date(at).getTime();
  if (!then || isNaN(then)) return "not pulled yet";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "pulled just now";
  if (mins < 60) return `pulled ${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `pulled ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `pulled ${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * `updatedAt` should be the moment the figures were retrieved — for live cards
 * that is React Query's `dataUpdatedAt` for the fetch that produced them.
 */
export function CardFreshness({
  from,
  to,
  updatedAt,
  className = "",
}: {
  from?: string | Date | null;
  to?: string | Date | null;
  updatedAt?: number | string | null;
  className?: string;
}) {
  const coverage = formatCoverage(from, to);
  const parts = [coverage, `figures ${formatPulled(updatedAt)}`].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className={`text-[11px] leading-snug text-muted-foreground ${className}`}>
      {parts.join(" · ")}
    </p>
  );
}
