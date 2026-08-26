import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getOrgWidgetMatrix,
  setOrgWidget,
  resetOrgTierToPlatformDefault,
} from "@/lib/tier-config.functions";
import { WIDGET_LABEL, toggleableWidgets, widgetKeyGroup, type WidgetKey } from "@/lib/tiers";

/**
 * "Cards included by default" for one organisation.
 *
 * Deny-list model: every card in the tier's plan is on unless it has been
 * switched off here. Writes go through public.set_org_widget_enabled, which
 * authorises the caller, seeds the organisation row from the platform default
 * and clears the card from each client's own exclusions when switching on.
 *
 * Merged cards (superannuation inside Money Held for Someone Else, cash
 * commitments inside Break-Even) are shown as ONE toggle and write BOTH stored
 * keys, so no pair is ever left half-switched.
 */
export function OrgDefaultCardsPanel({ firmId }: { firmId: string }) {
  const qc = useQueryClient();
  const fetchMatrix = useServerFn(getOrgWidgetMatrix);
  const toggle = useServerFn(setOrgWidget);
  const resetTier = useServerFn(resetOrgTierToPlatformDefault);

  const q = useQuery({
    queryKey: ["org-widget-matrix", firmId],
    queryFn: () => fetchMatrix({ data: { firmId } }),
    retry: false,
  });

  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  // One row per rendered card; deprecated keys never appear on their own.
  const cards = toggleableWidgets(tier.ceiling as string[]) as WidgetKey[];
  const excluded = new Set(tier.excluded as string[]);
  const platformExcluded = new Set(((tier as any).platformExcluded ?? []) as string[]);

  // What "follow the platform default again" would change, card by card.
  const willTurnOn = cards.filter((w) => excluded.has(w) && !platformExcluded.has(w));
  const willTurnOff = cards.filter((w) => !excluded.has(w) && platformExcluded.has(w));

  async function invalidateAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["org-widget-matrix", firmId] }),
      qc.invalidateQueries({ queryKey: ["tier-config"] }),
      qc.invalidateQueries({ queryKey: ["client-widgets"] }),
      qc.invalidateQueries({ queryKey: ["client-widget-matrix"] }),
      qc.invalidateQueries({ queryKey: ["effective-widgets"] }),
      qc.invalidateQueries({ queryKey: ["firm-allowed-widgets", firmId] }),
      qc.invalidateQueries({ queryKey: ["org-tier-overrides"] }),
    ]);
  }

  async function onToggle(w: WidgetKey, currentlyOn: boolean) {
    if (busy) return;
    setBusy(w);
    try {
      // Write every stored key the card is made of, so a merged pair can never
      // end up half-excluded.
      const keys = widgetKeyGroup(w).filter((k) => (tier.ceiling as string[]).includes(k));
      let cleared = 0;
      for (const key of keys) {
        const res = await toggle({
          data: { firmId, tier: tier.key, widget: key as WidgetKey, enabled: !currentlyOn },
        });
        cleared += res.clientsAffected;
      }
      await invalidateAll();

      const label = WIDGET_LABEL[w] ?? w;
      const plural = clientCount === 1 ? "client" : "clients";
      if (currentlyOn) {
        toast.success(`${label} turned off for all ${clientCount} ${plural}.`);
      } else {
        toast.success(
          `${label} turned on for all ${clientCount} ${plural}` +
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

  async function onReset() {
    setResetting(true);
    try {
      await resetTier({ data: { firmId, tier: tier.key } });
      await invalidateAll();
      setConfirmReset(false);
      toast.success(`${tier.label} now follows the platform default again.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not reset this tier");
    } finally {
      setResetting(false);
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
        {cards.length === 0 && (
          <span className="text-xs text-muted-foreground">
            This tier has no cards in its plan.
          </span>
        )}
        {cards.map((w) => {
          const off = excluded.has(w);
          return (
            <button
              key={w}
              type="button"
              onClick={() => onToggle(w, !off)}
              disabled={busy !== null}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                off
                  ? "bg-muted text-muted-foreground line-through"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {busy === w && <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />}
              {WIDGET_LABEL[w] ?? w}
            </button>
          );
        })}
      </div>

      {/* Whether this organisation still follows the platform default. The
          absence of a message is not an answer, so both states are stated. */}
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        {tier.usesOrgRow ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              This organisation has its own card list for the {tier.label} dashboard and no
              longer follows the platform default.
            </p>
            <Button size="sm" variant="outline" onClick={() => setConfirmReset(true)}>
              Follow platform default again
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Following the platform default for the {tier.label} dashboard.
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Click a card to switch it on or off for every client in this organisation —
        the change applies to all {clientCount} existing {clientCount === 1 ? "client" : "clients"}{" "}
        straight away, not just new ones. A struck-through card is switched off. The first
        change here gives this organisation its own card list, which then replaces the
        platform default for that dashboard.
      </p>

      <p className="mt-2 text-xs text-muted-foreground">
        Cards are set at three levels: the platform default (Dashboard tier widgets), this
        organisation (here), and one individual client. To change a single client, open that
        client from{" "}
        <Link to="/dashboard" className="text-primary hover:underline">
          All clients
        </Link>{" "}
        and use its settings screen.
      </p>

      <Dialog open={confirmReset} onOpenChange={(o) => !o && setConfirmReset(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow the platform default for {tier.label}?</DialogTitle>
            <DialogDescription>
              This deletes this organisation&apos;s own card list for the {tier.label}{" "}
              dashboard. It applies to all {clientCount}{" "}
              {clientCount === 1 ? "client" : "clients"} straight away, and can only be undone
              by switching each card again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {willTurnOn.length === 0 && willTurnOff.length === 0 ? (
              <p className="text-muted-foreground">
                No card changes: this organisation&apos;s list already matches the platform
                default. It will simply follow future platform changes again.
              </p>
            ) : (
              <>
                {willTurnOn.length > 0 && (
                  <p>
                    <span className="font-medium">Will turn on:</span>{" "}
                    {willTurnOn.map((w) => WIDGET_LABEL[w] ?? w).join(", ")}
                  </p>
                )}
                {willTurnOff.length > 0 && (
                  <p>
                    <span className="font-medium">Will turn off:</span>{" "}
                    {willTurnOff.map((w) => WIDGET_LABEL[w] ?? w).join(", ")}
                  </p>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Cards switched off for an individual client stay switched off.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onReset} disabled={resetting}>
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Follow platform default
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
