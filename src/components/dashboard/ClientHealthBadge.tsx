import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity } from "lucide-react";
import { getBusinessHealth } from "@/lib/health.functions";

const BAND_STYLES: Record<string, string> = {
  strong: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  watch: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300",
  urgent: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300",
};

export function ClientHealthBadge({ tenantId }: { tenantId: string | null | undefined }) {
  const fetchHealth = useServerFn(getBusinessHealth);
  const q = useQuery({
    queryKey: ["client-card-health", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchHealth({ data: { tenantId: tenantId! } }),
  });

  if (!tenantId) return null;

  if (q.isLoading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Activity className="h-3 w-3" /> Health loading…
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Activity className="h-3 w-3" /> Health unavailable
      </div>
    );
  }

  const styles = BAND_STYLES[q.data.band] ?? BAND_STYLES.watch;
  return (
    <div
      className={`mt-3 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${styles}`}
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Activity className="h-3 w-3" /> Business Health
      </span>
      <span className="tabular-nums">
        <strong className="font-semibold">{q.data.score}</strong>
        <span className="opacity-70">/100 · {q.data.label}</span>
      </span>
    </div>
  );
}
