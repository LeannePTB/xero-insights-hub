import { Activity } from "lucide-react";
import type { HealthBadgeSummary } from "@/lib/health.functions";
import { STATUS_LABEL } from "@/lib/health/health-checks";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Client-list Business Health badge: "x of 3 on track", from the same builder
 * as the dashboard card. The list fetches every client's summary in one
 * stored-data request; this component makes no request of its own.
 */

export function ClientHealthBadge({ summary, loading }: { summary: HealthBadgeSummary | undefined; loading?: boolean }) {
  const text = loading ? "Loading…" : summary ? summary.headline : "No saved figures yet";
  const tone = !summary || summary.counted === 0
    ? "border-dashed border-border bg-muted/30 text-muted-foreground"
    : summary.onTrack === summary.counted
      ? "border-success/30 bg-success/10 text-success"
      : summary.checks.some((c) => c.status === "red")
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-info/30 bg-info/10 text-info";
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`mt-3 inline-flex max-w-full cursor-help items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${tone}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <Activity className="h-3 w-3" />
            <span className="truncate font-medium">{text}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {summary ? (
            <ul className="space-y-1">
              {summary.checks.map((c) => (
                <li key={c.question}><span className="font-medium">{c.question}</span> {STATUS_LABEL[c.status as keyof typeof STATUS_LABEL] ?? c.status} · {c.figure}</li>
              ))}
            </ul>
          ) : "Business health uses last night's saved Xero figures."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
