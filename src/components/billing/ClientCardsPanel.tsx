import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getClientWidgetMatrix, setClientWidget } from "@/lib/tier-config.functions";
import { getCardModel } from "@/lib/card-model.functions";
import { ClientCardSetupPanel } from "@/components/billing/ClientCardSetupPanel";
import { WIDGET_LABEL, toggleableWidgets, widgetKeyGroup, type WidgetKey } from "@/lib/tiers";

/**
 * Per-client card toggles.
 *
 * The v2 path delegates to the purchase + per-client card editor. The
 * deny-list implementation below remains solely for rollback to v1.
 */
export function ClientCardsPanel({
  clientId,
  firmId,
}: {
  clientId: string;
  firmId?: string | null;
}) {
  const qc = useQueryClient();
  const fetchMatrix = useServerFn(getClientWidgetMatrix);
  const toggle = useServerFn(setClientWidget);
  const fetchModel = useServerFn(getCardModel);
  const [busy, setBusy] = useState<string | null>(null);

  // Under the purchase + ticked-list model the client has ONE list, capped by
  // what the organisation bought — the deny-list panel below is the old model.
  const modelQ = useQuery({ queryKey: ["card-model"], queryFn: () => fetchModel() });

  const q = useQuery({
    queryKey: ["client-widget-matrix", clientId],
    queryFn: () => fetchMatrix({ data: { clientId } }),
    enabled: modelQ.data?.active === false,
    retry: false,
  });

  if (modelQ.isLoading) {
    return (
      <p className="text-xs text-muted-foreground">
        <Loader2 className="mr-2 inline h-3 w-3 animate-spin" /> Loading cards…
      </p>
    );
  }
  if (modelQ.data?.active) {
    return <ClientCardSetupPanel clientId={clientId} firmId={firmId ?? null} />;
  }

  if (q.isLoading) {
    return (
      <p className="text-xs text-muted-foreground">
        <Loader2 className="mr-2 inline h-3 w-3 animate-spin" /> Loading cards…
      </p>
    );
  }

  // Fail closed: show nothing rather than a misleading list.
  if (q.error || !q.data || q.data.rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No cards are available for this client.
      </p>
    );
  }

  // One row per rendered card: deprecated keys (superannuation, true
  // break-even) render inside another card and never get a row of their own.
  const keysInList = new Set(q.data.rows.map((r) => r.widget as string));
  const canonicalRows = toggleableWidgets(q.data.rows.map((r) => r.widget as string));
  const byKey = new Map(q.data.rows.map((r) => [r.widget as string, r]));
  const rows = canonicalRows
    .map((k) => byKey.get(k))
    .filter((r): r is NonNullable<typeof r> => !!r);

  async function onToggle(w: WidgetKey, next: boolean) {
    if (busy) return;
    setBusy(w);
    try {
      // Merged cards write BOTH stored keys so a pair never half-toggles.
      for (const key of widgetKeyGroup(w)) {
        if (!keysInList.has(key)) continue;
        await toggle({ data: { clientId, widget: key as WidgetKey, enabled: next } });
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["client-widget-matrix", clientId] }),
        // Retained v1 cache keys for rollback only.
        qc.invalidateQueries({ queryKey: ["client-widgets", clientId] }),
        qc.invalidateQueries({ queryKey: ["effective-widgets", clientId] }),
        qc.invalidateQueries({ queryKey: ["tier-config"] }),
      ]);
      toast.success(
        `${WIDGET_LABEL[w] ?? w} switched ${next ? "on" : "off"} for this client.`,
      );
    } catch (e: any) {
      if (e?.message === "NOT_IN_TIER") {
        toast.error(
          `${WIDGET_LABEL[w] ?? w} is not available to this client.`,
        );
        qc.invalidateQueries({ queryKey: ["client-widget-matrix", clientId] });
      } else {
        toast.error(e?.message ?? "Could not change this card");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground">
        Cards available to this client. Switching one off here affects this client only.
      </p>

      <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
        {rows.map((r) => {
          const w = r.widget as WidgetKey;
          const orgOff = r.reason === "organisation";
          return (
            <li key={w} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="truncate">{WIDGET_LABEL[w] ?? w}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.on
                    ? "On"
                    : orgOff
                      ? "Switched off for the whole organisation"
                      : "Switched off for this client only"}
                </p>
              </div>
              {orgOff ? (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  Organisation setting
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  {busy === w && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={r.on}
                    disabled={busy !== null}
                    onCheckedChange={(v) => onToggle(w, v)}
                    aria-label={`${WIDGET_LABEL[w] ?? w} for this client`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
