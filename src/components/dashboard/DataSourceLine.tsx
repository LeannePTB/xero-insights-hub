import { AlertTriangle, PlugZap } from "lucide-react";
import type { SnapshotSource } from "@/lib/xero/snapshot-source";

// The single provenance line for every converted widget. No converted widget
// writes its own copy — one component, one set of words, everywhere.

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function fmtAgo(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function DataSourceLine({
  source,
  className = "",
}: {
  source: SnapshotSource | null | undefined;
  className?: string;
}) {
  if (!source) return null;

  const rows: React.ReactNode[] = [];

  if (source.connection === "disconnected") {
    rows.push(
      <span key="disc" className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
        <PlugZap className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Xero is disconnected. Figures are as at {fmtDate(source.asAt ?? source.fetchedAt)} and will not
          update until you reconnect.
        </span>
      </span>,
    );
  } else if (source.mode === "live") {
    rows.push(
      <span key="live" className="text-muted-foreground">
        Live from Xero · fetched {fmtAgo(source.fetchedAt)}
      </span>,
    );
  } else if (source.stale) {
    rows.push(
      <span key="stale" className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Figures may be out of date — as at {fmtDate(source.asAt)} · last updated{" "}
          {fmtAgo(source.fetchedAt)}. Refresh to update.
        </span>
      </span>,
    );
  } else {
    rows.push(
      <span key="fresh" className="text-muted-foreground">
        As at {fmtDate(source.asAt)} · updated {fmtAgo(source.fetchedAt)}
      </span>,
    );
  }

  if (!source.complete) {
    rows.push(
      <span key="partial" className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>Partial data — some records were not retrieved. Totals may be understated.</span>
      </span>,
    );
  }

  return <div className={`mt-1 space-y-0.5 text-[11px] leading-snug ${className}`}>{rows}</div>;
}

/**
 * Shown instead of figures when no snapshot exists yet. Absent data and zero
 * must never look the same.
 */
export function AwaitingSnapshot({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
      Figures are being prepared. Refresh to load them now.
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
