import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertCircle } from "lucide-react";
import { getBusinessHealth } from "@/lib/health.functions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const BAND_STYLES: Record<string, string> = {
  strong: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  watch: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300",
  urgent: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300",
};

/**
 * Shared gate so a list of clients doesn't fire every health request at once
 * (each badge is roughly two Xero calls). A few run concurrently and the rest
 * queue; each badge still renders the moment its own request resolves.
 * Retrying a 429 stays the job of `xeroGet` — no second retry layer here.
 */
const MAX_CONCURRENT_HEALTH_REQUESTS = 3;
let inFlight = 0;
const waiting: Array<() => void> = [];

async function withHealthSlot<T>(run: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT_HEALTH_REQUESTS) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  inFlight++;
  try {
    return await run();
  } finally {
    inFlight--;
    waiting.shift()?.();
  }
}

export function ClientHealthBadge({
  tenantId,
  clientId,
}: {
  tenantId: string | null | undefined;
  clientId?: string;
}) {
  const fetchHealth = useServerFn(getBusinessHealth);
  const q = useQuery({
    // Keyed by the client as well as the Xero file, so no two rows can share a
    // cache entry.
    queryKey: ["client-card-health", clientId ?? null, tenantId],
    enabled: !!tenantId,
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: () => withHealthSlot(() => fetchHealth({ data: { tenantId: tenantId! } })),
  });

  if (!tenantId) {
    return (
      <Unavailable reason="No Xero organisation is linked to this client, so there is nothing to score." />
    );
  }

  if (q.isPending) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Activity className="h-3 w-3" /> Health loading…
      </div>
    );
  }

  if (q.error || !q.data) {
    const reason =
      (q.error as Error | null)?.message?.trim() ||
      "Xero didn't return the figures needed for this score.";
    return <Unavailable reason={reason} />;
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

/** A failure is always visible: never a blank where a badge should be. */
function Unavailable({ reason }: { reason: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="mt-3 inline-flex cursor-help items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <AlertCircle className="h-3 w-3" /> Business Health unavailable
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {reason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
