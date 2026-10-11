import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resyncClient } from "@/lib/xero/snapshot-refresh.functions";
import {
  RESYNC_CONFIRM_ABOVE,
  RESYNC_REASON,
  resyncEstimateMinutes,
  type ResyncOutcome,
} from "@/lib/xero/resync-reasons";

export type ResyncState =
  | { phase: "queued" }
  | { phase: "syncing" }
  | { phase: "done"; outcome: ResyncOutcome };

const COOLDOWN_MS = 2 * 60 * 1000;
const FAILED: ResyncOutcome[] = ["reconnect", "failed", "rate_limited", "not_connected"];

/**
 * Browser-side queue: one client at a time, so one Xero connection is in
 * flight per person. Every limit and permission is enforced on the server;
 * this only paces requests and shows progress.
 */
export function useResyncQueue() {
  const run = useServerFn(resyncClient);
  const qc = useQueryClient();
  const [states, setStates] = useState<Record<string, ResyncState>>({});
  const [running, setRunning] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [, tick] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!cooldownUntil) return;
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  const start = useCallback(
    async (clientIds: string[]) => {
      if (busy.current || !clientIds.length) return;
      busy.current = true;
      setRunning(true);
      setStates((s) => ({ ...s, ...Object.fromEntries(clientIds.map((id) => [id, { phase: "queued" } as ResyncState])) }));
      let stop = false;
      for (const id of clientIds) {
        if (stop) {
          setStates((s) => ({ ...s, [id]: { phase: "done", outcome: "rate_limited" } }));
          continue;
        }
        setStates((s) => ({ ...s, [id]: { phase: "syncing" } }));
        let outcome: ResyncOutcome;
        try {
          outcome = (await run({ data: { clientId: id } })).outcome;
        } catch {
          outcome = "failed";
        }
        if (outcome === "rate_limited") stop = true;
        setStates((s) => ({ ...s, [id]: { phase: "done", outcome } }));
      }
      busy.current = false;
      setRunning(false);
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      await qc.invalidateQueries({ queryKey: ["client-overview"] });
    },
    [run, qc],
  );

  const coolingDown = Date.now() < cooldownUntil;
  return { states, running, coolingDown, start };
}

function relative(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function ResyncHeader({
  clientIds,
  lastSynced,
  queue,
}: {
  clientIds: string[];
  lastSynced: string | null;
  queue: ReturnType<typeof useResyncQueue>;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!clientIds.length) return null;
  const done = Object.values(queue.states).filter((s) => s.phase === "done").length;
  const total = Object.keys(queue.states).length;
  const go = () => {
    setConfirming(false);
    void queue.start(clientIds);
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <span className="text-xs text-muted-foreground">Last synced {relative(lastSynced)}</span>
      {confirming ? (
        <div className="flex items-center gap-2 text-xs">
          <span>
            {clientIds.length} clients, roughly {resyncEstimateMinutes(clientIds.length)} min.
          </span>
          <Button size="sm" onClick={go}>Start</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={queue.running || queue.coolingDown}
          title={queue.coolingDown ? "Re-synced a moment ago — available again in a couple of minutes." : "Pull fresh figures from Xero now"}
          onClick={() => (clientIds.length > RESYNC_CONFIRM_ABOVE ? setConfirming(true) : go())}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${queue.running ? "animate-spin" : ""}`} />
          {queue.running ? `Re-syncing ${done}/${total}…` : "Re-sync"}
        </Button>
      )}
    </div>
  );
}

export function ResyncRowControl({
  clientId,
  queue,
}: {
  clientId: string;
  queue: ReturnType<typeof useResyncQueue>;
}) {
  const s = queue.states[clientId];
  if (s?.phase === "queued") return <span className="text-xs text-muted-foreground">Queued</span>;
  if (s?.phase === "syncing")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing
      </span>
    );
  if (s?.phase === "done") {
    const bad = FAILED.includes(s.outcome);
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs ${bad ? "text-destructive" : "text-success"}`}
        title={RESYNC_REASON[s.outcome]}
      >
        {bad ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {bad ? RESYNC_REASON[s.outcome] : "Done"}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="inline-flex items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
      title="Re-sync this client from Xero"
      aria-label="Re-sync this client from Xero"
      disabled={queue.running}
      onClick={(e) => {
        e.stopPropagation();
        void queue.start([clientId]);
      }}
    >
      <RefreshCw className="h-3.5 w-3.5" />
    </button>
  );
}
