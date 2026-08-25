import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getClientWidgetMatrix, setClientWidget } from "@/lib/tier-config.functions";
import { WIDGET_LABEL, type WidgetKey } from "@/lib/tiers";
import { InTestingBadge } from "@/components/dashboard/InTestingBadge";

/**
 * Per-client card toggles.
 *
 * The list is the cards in this client's effective tier; the current state
 * comes from public.client_allowed_widgets. Every write goes through
 * public.set_client_widget_enabled. Exclusions resolve platform ->
 * organisation -> client, each only adding to the deny list, so a card the
 * organisation has switched off cannot be switched back on here — those rows
 * are shown without a working switch instead.
 */
export function ClientCardsPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const fetchMatrix = useServerFn(getClientWidgetMatrix);
  const toggle = useServerFn(setClientWidget);
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["client-widget-matrix", clientId],
    queryFn: () => fetchMatrix({ data: { clientId } }),
    retry: false,
  });

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
        No cards are available for this client&apos;s dashboard tier.
      </p>
    );
  }

  async function onToggle(w: WidgetKey, next: boolean) {
    if (busy) return;
    setBusy(w);
    try {
      await toggle({ data: { clientId, widget: w, enabled: next } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["client-widget-matrix", clientId] }),
        // The dashboard reads ["client-widgets", clientId, <preview tier>].
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
          `${WIDGET_LABEL[w] ?? w} is not part of this client's dashboard tier. Change the tier above to include it.`,
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
        Cards included in this client&apos;s dashboard tier. Switching one off here affects
        this client only.{" "}
        <Link to="/clients/$clientId/settings" params={{ clientId }} hash="dashboard-tier" className="text-primary hover:underline">
          Dashboard tier
        </Link>{" "}
        decides which cards appear in this list.
      </p>

      <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
        {q.data.rows.map((r) => {
          const w = r.widget as WidgetKey;
          const orgOff = r.reason === "organisation";
          return (
            <li key={w} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="truncate">{WIDGET_LABEL[w] ?? w}</span>
                  {(r as any).wip && <InTestingBadge />}
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
