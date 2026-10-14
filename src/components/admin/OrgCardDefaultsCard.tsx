import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LayoutTemplate, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  applyOrgCardDefaults,
  getOrgCardDefaults,
  getOrgPurchase,
  saveOrgCardDefaults,
  getOrgCardContext,
} from "@/lib/card-model.functions";
import {
  activeModules,
  defaultCardsFromModules,
  EMPTY_CATALOGUE,
  moduleCards,
  moduleState,
  packageCards,
} from "@/lib/cards/catalogue";

/**
 * Default cards for new clients.
 *
 * A template, not a layer. It decides what a new client's own ticked list
 * STARTS as — the database copies it in the same transaction that creates the
 * client. Resolving a dashboard never reads it: that is still the purchase
 * intersected with the one list stored for that client.
 *
 * Nothing is decided here. public.set_org_card_defaults and
 * public.apply_org_card_defaults each re-check the second factor and active
 * membership of this organisation, and write their own audit row.
 */
export function OrgCardDefaultsCard({ firmId }: { firmId: string }) {
  const qc = useQueryClient();
  const fetchPurchase = useServerFn(getOrgPurchase);
  const fetchDefaults = useServerFn(getOrgCardDefaults);
  const save = useServerFn(saveOrgCardDefaults);
  const apply = useServerFn(applyOrgCardDefaults);
  const fetchContext = useServerFn(getOrgCardContext);
  const ctxQ = useQuery({
    queryKey: ["org-card-context", firmId],
    queryFn: () => fetchContext({ data: { firmId } }),
    retry: false,
  });
  const catalogue = ctxQ.data?.catalogue ?? EMPTY_CATALOGUE;
  const canManage = ctxQ.data?.canManage === true;

  const purchaseQ = useQuery({
    queryKey: ["org-purchase", firmId],
    queryFn: () => fetchPurchase({ data: { firmId } }),
    retry: false,
  });
  const defaultsQ = useQuery({
    queryKey: ["org-card-defaults", firmId],
    queryFn: () => fetchDefaults({ data: { firmId } }),
    retry: false,
  });

  const [ticked, setTicked] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  const purchase = purchaseQ.data?.purchase;
  const groups = purchaseQ.data?.groups ?? [];
  const clientCount = purchase?.clientCount ?? 0;

  // Which cards this organisation's purchase allows. The same three groups the
  // purchase screen shows, on the same conditions the database applies.
  const availableGroups = useMemo(
    () =>
      groups.filter((g) => {
        if (g.group === "standard") return true;
        if (g.group === "advisory") return !!purchase?.effectiveAdvisory;
        if (g.group === "consolidation") {
          return !!purchase?.effectiveConsolidation && clientCount > 1;
        }
        return false;
      }),
    [groups, purchase?.effectiveAdvisory, purchase?.effectiveConsolidation, clientCount],
  );
  const available = useMemo(
    () => availableGroups.flatMap((g) => g.cards),
    [availableGroups],
  );

  // Unset default = every available card, which is exactly what a new client
  // gets today. Ticks are shown that way so the screen never implies otherwise.
  useEffect(() => {
    if (!defaultsQ.data || !purchaseQ.data) return;
    setTicked(defaultsQ.data.configured ? defaultsQ.data.cards : available);
  }, [defaultsQ.data, purchaseQ.data, available.join(",")]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: { firmId, cards: ticked ?? [] } }),
    onSuccess: () => {
      toast.success("Default card set saved");
      qc.invalidateQueries({ queryKey: ["org-card-defaults", firmId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save the default card set"),
  });

  const applyMut = useMutation({
    mutationFn: () => apply({ data: { firmId } }),
    onSuccess: (r) => {
      setConfirming(false);
      toast.success(
        r.clientsChanged === 1
          ? "Applied to 1 client"
          : `Applied to ${r.clientsChanged} clients`,
      );
      qc.invalidateQueries({ queryKey: ["client-card-setup"] });
      qc.invalidateQueries({ queryKey: ["client-widgets"] });
      qc.invalidateQueries({ queryKey: ["effective-widgets"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => {
      setConfirming(false);
      toast.error(e?.message ?? "Could not apply the default card set");
    },
  });

  if (purchaseQ.isLoading || defaultsQ.isLoading || ctxQ.isLoading) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> Loading default cards…
        </p>
      </section>
    );
  }
  const error = (purchaseQ.error ?? defaultsQ.error) as Error | null;
  if (error || !purchase) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <p className="text-sm text-destructive">{error?.message ?? "Not available"}</p>
      </section>
    );
  }

  const current = ticked ?? [];
  const on = new Set(current);
  const availableSet = new Set(available);
  const modules = activeModules(catalogue)
    .map((m) => ({ ...m, cards: moduleCards(catalogue, m.key).filter((c) => availableSet.has(c)) }))
    .filter((m) => m.cards.length > 0);
  const consCards = packageCards(catalogue, "consolidation").filter((c) => availableSet.has(c));
  const consOn = consCards.length > 0 && consCards.every((c) => on.has(c));
  const ticksFrom = (mods: string[], cons: boolean) =>
    defaultCardsFromModules(catalogue, mods, cons).filter((c) => availableSet.has(c));
  const onModules = modules.filter((m) => moduleState(m.cards, on) === "on").map((m) => m.key);
  const setModule = (key: string, value: boolean) =>
    setTicked(ticksFrom(value ? [...onModules, key] : onModules.filter((k) => k !== key), consOn));

  const saved = defaultsQ.data?.configured ? defaultsQ.data.cards : null;
  const dirty =
    saved === null
      ? current.length !== available.length ||
        !available.every((c) => current.includes(c))
      : current.length !== saved.length || !saved.every((c) => current.includes(c));

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <LayoutTemplate className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Default modules for new clients</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        The modules a client added to this organisation from now on starts with. Standard is always
        included. This applies when the client is created and never afterwards, unless you use
        Apply to all clients.
        {!canManage && " Only the Organisation Owner can change this."}
      </p>
      {!defaultsQ.data?.configured && (
        <p className="text-sm text-muted-foreground">
          No default has been saved yet, so new clients currently start with everything this
          organisation has bought.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">Standard — always included</p>
        {modules.length > 0 && <p className="pt-2 text-xs font-medium uppercase text-muted-foreground">Advisory modules</p>}
        {modules.map((m) => {
          const st = moduleState(m.cards, on);
          return (
            <label key={m.key} className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <Checkbox
                className="mt-0.5"
                disabled={!canManage}
                checked={st === "on" ? true : st === "partial" ? "indeterminate" : false}
                onCheckedChange={() => setModule(m.key, st !== "on")}
              />
              <span>
                <span className="block font-medium">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.description}</span>
              </span>
            </label>
          );
        })}
        {consCards.length > 0 && (
          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <Checkbox className="mt-0.5" disabled={!canManage} checked={consOn} onCheckedChange={(v) => setTicked(ticksFrom(onModules, v === true))} />
            <span className="font-medium">Consolidation</span>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => saveMut.mutate()} disabled={!canManage || !dirty || saveMut.isPending}>
          {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save default modules
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirming(true)}
          disabled={!canManage || !defaultsQ.data?.configured || clientCount === 0 || applyMut.isPending}
        >
          Apply to all clients in this organisation
        </Button>
        {!defaultsQ.data?.configured && (
          <span className="text-xs text-muted-foreground">
            Save the default first to apply it to existing clients.
          </span>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Apply this default to {clientCount} {clientCount === 1 ? "client" : "clients"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Every one of the {clientCount} {clientCount === 1 ? "client" : "clients"} in this
              organisation will have its current ticks replaced by the saved default modules. Any
              card a client has turned on or off individually is overwritten and cannot be recovered
              except by setting it again. This is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => applyMut.mutate()} disabled={applyMut.isPending}>
              {applyMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Replace ticks for {clientCount} {clientCount === 1 ? "client" : "clients"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
