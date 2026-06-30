import { useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { Pillar, PillarStatus } from "@/lib/health.functions";
import { cn } from "@/lib/utils";

function pillClasses(status: PillarStatus): string {
  switch (status) {
    case "good":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "watch":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    case "bad":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
    case "not_in_xero":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function scoreColors(score: number | null) {
  if (score === null) return { text: "text-muted-foreground", bar: "bg-muted" };
  if (score >= 70) return { text: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (score >= 50) return { text: "text-amber-700 dark:text-amber-400", bar: "bg-amber-500" };
  return { text: "text-destructive", bar: "bg-destructive" };
}

type Props = {
  pillar: Pillar;
  expandable?: boolean;
  renderExpanded?: () => ReactNode;
};

export function PillarCard({ pillar, expandable = false, renderExpanded }: Props) {
  const [open, setOpen] = useState(false);
  const colors = scoreColors(pillar.score);
  const scorePct = pillar.score ?? 0;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div>
        <h4 className="font-display text-base font-semibold text-foreground">{pillar.title}</h4>
        <p className="text-xs text-muted-foreground">{pillar.subtitle}</p>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-1">
          <span className={cn("font-display text-4xl font-bold tabular-nums", colors.text)}>
            {pillar.score ?? "—"}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", colors.bar)} style={{ width: `${scorePct}%` }} />
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-2.5">
        {pillar.metrics.map((m, i) => (
          <div key={i} className="flex items-start justify-between gap-3">
            <span className="text-sm text-foreground/90">{m.label}</span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight",
                pillClasses(m.status),
              )}
            >
              {m.pill}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        disabled={!expandable}
        className={cn(
          "mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-medium text-foreground transition",
          expandable
            ? "hover:bg-accent cursor-pointer"
            : "cursor-not-allowed opacity-60",
        )}
        title={expandable ? undefined : "Coming soon"}
      >
        <span>{pillar.ctaLabel}</span>
        {expandable ? (
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        ) : (
          <ArrowUpRight className="h-4 w-4" />
        )}
      </button>

      {expandable && open && renderExpanded && <div>{renderExpanded()}</div>}
    </div>
  );
}
