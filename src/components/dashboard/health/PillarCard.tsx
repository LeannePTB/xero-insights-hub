import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Pillar } from "@/lib/health.functions";
import { StatusPill } from "./StatusPill";

function bandFor(score: number | null): "good" | "watch" | "bad" | "neutral" {
  if (score === null) return "neutral";
  if (score >= 80) return "good";
  if (score >= 60) return "watch";
  return "bad";
}

const BAR: Record<"good" | "watch" | "bad" | "neutral", string> = {
  good: "bg-emerald-500",
  watch: "bg-amber-500",
  bad: "bg-rose-500",
  neutral: "bg-muted-foreground/30",
};

const SCORE_TEXT: Record<"good" | "watch" | "bad" | "neutral", string> = {
  good: "text-emerald-700 dark:text-emerald-400",
  watch: "text-amber-700 dark:text-amber-400",
  bad: "text-rose-700 dark:text-rose-400",
  neutral: "text-muted-foreground",
};

export function PillarCard({ pillar, onCta }: { pillar: Pillar; onCta?: () => void }) {
  const band = bandFor(pillar.score);
  const pct = pillar.score === null ? 0 : Math.max(2, pillar.score);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div>
        <h3 className="font-display text-base font-semibold">{pillar.title}</h3>
        <p className="text-sm text-muted-foreground">{pillar.subtitle}</p>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-1">
          <span className={`font-display text-3xl font-semibold tabular-nums ${SCORE_TEXT[band]}`}>
            {pillar.score === null ? "—" : pillar.score}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all ${BAR[band]}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="mt-4 space-y-2.5 text-sm">
        {pillar.metrics.map((m, i) => (
          <li key={i} className="flex items-start justify-between gap-3">
            <span className="text-foreground/90">{m.label}</span>
            <StatusPill status={m.status}>{m.pill}</StatusPill>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4">
        <Button variant="outline" size="sm" className="w-full justify-center" onClick={onCta}>
          {pillar.ctaLabel} <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
