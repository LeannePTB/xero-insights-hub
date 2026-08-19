import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getOrgWidgetMatrix, setOrgWidget } from "@/lib/tier-config.functions";
import { WIDGET_LABEL, type WidgetKey } from "@/lib/tiers";

/**
 * "Cards included by default" for one organisation.
 *
 * Deny-list model: every card in the tier's plan is on unless it has been
 * switched off here. Writes go through public.set_org_widget_enabled, which
 * authorises the caller, seeds the organisation row from the platform default
 * and clears the card from each client's own exclusions when switching on.
 */
export function OrgDefaultCardsPanel({ firmId }: { firmId: string }) {
  const qc = useQueryClient();
  const fetchMatrix = useServerFn(getOrgWidgetMatrix);
  const toggle = useServerFn(setOrgWidget);

  const q = useQuery({
    queryKey: ["org-widget-matrix", firmId],
    queryFn: () => fetchMatrix({ data: { firmId } }),
    retry: false,
  });

  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (q.isLoading) {
    return (
      <p className="mt-1.5 text-xs text-muted-foreground">
        <Loader2 className="mr-2 inline h-3 w-3 animate-spin" /> Loading cards…
      </p>
    );
  }
  // Fail closed: show nothing rather than a misleading list.
  if (q.error || !q.data || q.data.tiers.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-muted-foreground">
        No dashboard tiers are available for this organisation&apos;s plan.
      </p>
    );
  }

  const tiers = q.data.tiers;
  const tier = tiers.find((t) => t.key === activeTier) ?? tiers[tiers.length - 1]!;
  const clientCount = q.data.clientCount;

  async function onToggle(w: WidgetKey, currentlyOn: boolean) {
    if (busy) return;
    setBusy(w);
    try {
      const res = await toggle({
        data: { firmId, tier: tier.key, widget: w, enabled: !currentlyOn },
      });
      await qc.invalidateQueries({ queryKey: ["org-widget-matrix", firmId] });
      qc.invalidateQueries({ queryKey: ["firm-plan-summary", firmId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client-widgets"] });
      qc.invalidateQueries({ queryKey: ["effective-widgets"] });
      qc.invalidateQueries({ queryKey: ["firm-allowed-widgets", firmId] });

      const label = WIDGET_LABEL[w] ?? w;
      const clients = res.clientCount ?? clientCount;
      const plural = clients === 1 ? "client" : "clients";
      if (currentlyOn) {
        toast.success(`${label} turned off for all ${clients} ${plural}.`);
      } else {
        const cleared = res.overridesCleared ?? 0;
        toast.success(
          `${label} turned on for all ${clients} ${plural}` +
            (cleared > 0
              ? ` — ${cleared} client override${cleared === 1 ? "" : "s"} cleared.`
              : "."),
        );
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not change this card");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {tiers.length > 1 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {tiers.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTier(t.key)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                t.key === tier.key
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {tier.ceiling.length === 0 && (
          <span className="text-xs text-muted-foreground">
            This tier has no cards in its plan.
          </span>
        )}
        {tier.ceiling.map((w) => {
          const off = tier.excluded.includes(w as WidgetKey);
          return (
            <button
              key={w}
              type="button"
              onClick={() => onToggle(w as WidgetKey, !off)}
              disabled={busy !== null}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                off
                  ? "bg-muted text-muted-foreground line-through"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {busy === w && <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />}
              {WIDGET_LABEL[w as WidgetKey] ?? w}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Click a card to switch it on or off for every client in this organisation —
        the change applies to all {clientCount} existing {clientCount === 1 ? "client" : "clients"}{" "}
        straight away, not just new ones. A struck-through card is switched off. Any card
        added to this tier&apos;s plan later is included automatically, and each client&apos;s
        own settings can still switch cards off individually.
      </p>
    </div>
  );
}
