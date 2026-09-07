// The one live-state indicator for dashboard cards. Presentation only: it
// reads state the card already has and never triggers, schedules or changes a
// fetch. It sits alongside the existing freshness wording, never replaces it.
//
// Honesty rule: the pulsing "live" dot means figures came from a live call to
// Xero within the last few minutes. Stored snapshots and ageing figures get a
// still dot, never a pulse.

export type LiveState = "fetching" | "live" | "aging" | "stale" | "stored" | "disconnected";

/** Figures pulled within this window still count as live. */
const LIVE_WINDOW_MS = 5 * 60 * 1000;
/** Past this, a live pull is no longer presented as current. */
const AGING_WINDOW_MS = 60 * 60 * 1000;

/**
 * Work out the state from signals the card already holds.
 * `fetchedAt` is the moment the figures were retrieved (React Query's
 * `dataUpdatedAt` for live cards, `source.fetchedAt` for stored ones).
 */
export function deriveLiveState(input: {
  isFetching?: boolean;
  hasData?: boolean;
  fetchedAt?: number | string | null;
  /** true when the figures came from a stored snapshot rather than a live call */
  isStored?: boolean;
  /** the stored snapshot's own stale flag */
  isStale?: boolean;
  isDisconnected?: boolean;
}): LiveState | null {
  if (input.isFetching) return "fetching";
  if (input.isDisconnected) return "disconnected";
  if (!input.hasData && !input.fetchedAt) return null;
  if (input.isStale) return "stale";
  if (input.isStored) return "stored";

  const at =
    typeof input.fetchedAt === "number"
      ? input.fetchedAt
      : input.fetchedAt
        ? new Date(input.fetchedAt).getTime()
        : NaN;
  if (!at || isNaN(at)) return null;
  const age = Date.now() - at;
  if (age <= LIVE_WINDOW_MS) return "live";
  if (age <= AGING_WINDOW_MS) return "aging";
  return "stale";
}

const STATES: Record<LiveState, { dot: string; ring: boolean; label: string; tone: string }> = {
  fetching: {
    dot: "bg-sky-500",
    ring: true,
    label: "Fetching from Xero",
    tone: "text-sky-700 dark:text-sky-400",
  },
  live: {
    dot: "bg-emerald-500",
    ring: true,
    label: "Live from Xero",
    tone: "text-emerald-700 dark:text-emerald-400",
  },
  aging: {
    dot: "bg-emerald-500/60",
    ring: false,
    label: "From Xero, not just now",
    tone: "text-muted-foreground",
  },
  stale: {
    dot: "bg-amber-500",
    ring: false,
    label: "May be out of date",
    tone: "text-amber-700 dark:text-amber-400",
  },
  stored: {
    dot: "bg-muted-foreground/60",
    ring: false,
    label: "Saved figures, not a live call",
    tone: "text-muted-foreground",
  },
  disconnected: {
    dot: "bg-muted-foreground/50",
    ring: false,
    label: "Xero disconnected",
    tone: "text-muted-foreground",
  },
};

/**
 * A small dot with an accessible label. The pulse is dropped entirely for
 * anyone who has asked for reduced motion — `motion-reduce:animate-none` on
 * the halo and `motion-reduce:hidden` so nothing is left mid-fade.
 */
export function LiveDot({
  state,
  showLabel = false,
  className = "",
}: {
  state: LiveState | null | undefined;
  showLabel?: boolean;
  className?: string;
}) {
  if (!state) return null;
  const s = STATES[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 align-middle ${className}`}
      title={s.label}
    >
      <span className="relative inline-flex h-2 w-2 shrink-0">
        {s.ring && (
          <span
            aria-hidden="true"
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden motion-reduce:animate-none ${s.dot}`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
      </span>
      <span className={showLabel ? `text-[11px] leading-none ${s.tone}` : "sr-only"}>
        {s.label}
      </span>
    </span>
  );
}
