import { getStabilityRecommendations } from "@/lib/health.recommendations";
import type { PillarMetric } from "@/lib/health.functions";
import { AlertTriangle, Info, TrendingUp } from "lucide-react";

export function StabilityRecommendations({ metrics }: { metrics: PillarMetric[] }) {
  const recs = getStabilityRecommendations(metrics);

  return (
    <div className="mt-4 space-y-3">
      {recs.map((r, i) => {
        const tone =
          r.severity === "danger"
            ? "border-l-destructive bg-destructive/5"
            : r.severity === "watch"
              ? "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"
              : "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20";
        const Icon = r.severity === "danger" ? AlertTriangle : r.severity === "watch" ? TrendingUp : Info;
        const iconColor =
          r.severity === "danger"
            ? "text-destructive"
            : r.severity === "watch"
              ? "text-amber-700 dark:text-amber-400"
              : "text-emerald-700 dark:text-emerald-400";
        return (
          <div key={i} className={`rounded-lg border border-border border-l-4 p-3 ${tone}`}>
            <div className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.why}</p>
                <ul className="mt-2 space-y-1 text-xs text-foreground/90">
                  {r.actions.map((a, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
