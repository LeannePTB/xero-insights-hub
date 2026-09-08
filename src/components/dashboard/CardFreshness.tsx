import { LiveDot, deriveLiveState } from "@/components/dashboard/LiveDot";
import type { SnapshotSource } from "@/lib/xero/snapshot-source";


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
 * The freshness line for every live dashboard card.
 *
 * It takes PROVENANCE, never a timestamp. A React Query `dataUpdatedAt` is the
 * moment OUR query ran, which is not the moment the figures were pulled from
 * Xero — feeding it here is what made Business Health claim live figures over
 * a copy saved at 3am. The only accepted input is the `SnapshotSource` the
 * server function returns alongside its figures, so a query time can no longer
 * be passed at all: it is a number, and this prop is not.
 */
export function CardFreshness({
  from,
  to,
  source,
  isFetching,
  className = "",
}: {
  from?: string | Date | null;
  to?: string | Date | null;
  /** Provenance from the server function that produced these figures. */
  source?: SnapshotSource | null;
  /** React Query's `isFetching` for the query that produced these figures. */
  isFetching?: boolean;
  className?: string;
}) {
  const coverage = formatCoverage(from, to);
  const stored = !!source && source.mode === "snapshot";
  const pulled = formatPulled(source?.fetchedAt);
  const provenance = !source
    ? "figures not pulled yet"
    : source.mode === "pending"
      ? "figures not pulled yet"
      : source.mixed
        ? `partly saved figures · oldest ${pulled}`
        : stored
          ? `saved figures · ${pulled}`
          : `figures ${pulled}`;
  const parts = [coverage, provenance].filter(Boolean);
  if (parts.length === 0) return null;
  // Live state comes from the same provenance, so a stored copy can never
  // pulse and can never be labelled "Live from Xero".
  const liveState = deriveLiveState({
    isFetching,
    hasData: Boolean(source?.fetchedAt),
    fetchedAt: source?.fetchedAt ?? null,
    isStored: stored || !!source?.mixed,
    isStale: Boolean(source?.stale),
    isDisconnected: source?.connection === "disconnected",
  });
  // Ageing figures must say so in words, not only in the colour of the dot.
  const overdue = !!source?.stale && !isFetching;
  return (
    <p className={`flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground ${className}`}>
      <LiveDot state={liveState} />
      <span>
        {parts.join(" · ")}
        {overdue && (
          <span className="text-amber-700 dark:text-amber-400">
            {" · not updated since before last night — may be out of date"}
          </span>
        )}
      </span>
    </p>
  );

}

