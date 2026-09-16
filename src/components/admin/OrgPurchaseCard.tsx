import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuperAdminChip } from "@/components/admin/SuperAdminOnly";
import {
  getOrgPurchase,
  saveOrgPurchase,
  saveOrgTrial,
  type OrgPurchase,
} from "@/lib/card-model.functions";
import { getMyContext } from "@/lib/roles.functions";
import { cardLabel, CARD_GROUP_LABEL } from "@/lib/card-labels";
import { trialStatus, TRIAL_MAX_DAYS, TRIAL_WARN_DAYS } from "@/lib/org-trial";

/**
 * What this organisation has bought: number of clients, Advisory, Consolidation
 * and how it is billed. This is the screen that decides which cards exist for
 * every client in the organisation.
 *
 * Writing goes through public.set_org_purchase, which re-checks the second
 * factor and super admin itself and writes an audit row. Nothing is decided
 * here.
 */
export function OrgPurchaseCard({ firmId }: { firmId: string }) {
  const qc = useQueryClient();
  const fetchPurchase = useServerFn(getOrgPurchase);
  const save = useServerFn(saveOrgPurchase);
  const fetchCtx = useServerFn(getMyContext);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const q = useQuery({
    queryKey: ["org-purchase", firmId],
    queryFn: () => fetchPurchase({ data: { firmId } }),
    retry: false,
  });

  const [clientLimit, setClientLimit] = useState("");
  const [advisory, setAdvisory] = useState(false);
  const [consolidation, setConsolidation] = useState(false);
  const [branding, setBranding] = useState(false);
  const [billingMode, setBillingMode] = useState<"bookkeeping" | "external">("bookkeeping");

  useEffect(() => {
    const p = q.data?.purchase;
    if (!p) return;
    setClientLimit(String(p.clientLimit));
    setAdvisory(p.advisory);
    setConsolidation(p.consolidation);
    setBranding(p.branding);
    setBillingMode(p.billingMode);
  }, [q.data?.purchase]);

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          firmId,
          clientLimit: Number(clientLimit || 0),
          advisory,
          consolidation,
          branding,
          billingMode,
        },
      }),
    onSuccess: () => {
      toast.success("Purchase saved");
      qc.invalidateQueries({ queryKey: ["org-purchase", firmId] });
      qc.invalidateQueries({ queryKey: ["client-branding"] });
      qc.invalidateQueries({ queryKey: ["report-logo"] });
      qc.invalidateQueries({ queryKey: ["client-card-setup"] });
      qc.invalidateQueries({ queryKey: ["client-widgets"] });
      qc.invalidateQueries({ queryKey: ["effective-widgets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save the purchase"),
  });

  const canEdit = !!ctxQ.data?.isSuperAdmin;
  const purchase = q.data?.purchase;
  const clientCount = purchase?.clientCount ?? 0;
  const singleClient = clientCount <= 1;
  const groups = q.data?.groups ?? [];
  const groupCards = (g: string) => groups.find((x) => x.group === g)?.cards ?? [];

  if (q.isLoading) {
    return (
      <section className="rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> Loading purchase…
        </p>
      </section>
    );
  }
  if (q.error || !purchase) {
    return (
      <section className="rounded-lg border p-6">
        <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Not available"}</p>
      </section>
    );
  }

  const dirty =
    Number(clientLimit || 0) !== purchase.clientLimit ||
    advisory !== purchase.advisory ||
    consolidation !== purchase.consolidation ||
    branding !== purchase.branding ||
    billingMode !== purchase.billingMode;

  return (
    <section className="space-y-4 rounded-lg border p-6">
      <div className="flex flex-wrap items-center gap-2">
        <ShoppingCart className="h-4 w-4" />
        <h2 className="text-lg font-semibold">What this organisation has bought</h2>
        {canEdit && <SuperAdminChip />}
      </div>
      <p className="text-sm text-muted-foreground">
        These options decide which cards exist for every client in this organisation. Each client's
        own ticked list then decides which of them that client sees.
        {!q.data?.modelActive && " The new model is not switched on yet, so this is not live."}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Clients</Label>
          <Input
            type="number"
            min={0}
            disabled={!canEdit}
            value={clientLimit}
            onChange={(e) => setClientLimit(e.target.value.replace(/[^\d]/g, ""))}
          />
          <p className="text-xs text-muted-foreground">
            How many clients this organisation is paying for. It has {clientCount} today.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Billing</Label>
          <Select
            value={billingMode}
            disabled={!canEdit}
            onValueChange={(v) => setBillingMode(v as "bookkeeping" | "external")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bookkeeping">Included in bookkeeping fees</SelectItem>
              <SelectItem value="external">Billed externally</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Advisory</p>
            <p className="text-xs text-muted-foreground">
              Adds {groupCards("advisory").map(cardLabel).join(", ") || "the advisory cards"}.
              Switching it on ticks them for every client; switching it off hides them and keeps
              each client's ticks for when it comes back.
            </p>
          </div>
          <Switch
            checked={advisory}
            disabled={!canEdit}
            onCheckedChange={(v) => {
              setAdvisory(v);
              if (!v && consolidation) {
                setConsolidation(false);
                toast.message("Consolidation switched off too", {
                  description:
                    "Consolidation extends Advisory, so it cannot stay on. The per-client ticks are kept.",
                });
              }
              if (!v && branding) {
                setBranding(false);
                toast.message("Branding switched off too", {
                  description:
                    "Branding extends Advisory, so it cannot stay on. Logos already uploaded stay where they are and come back if Branding is switched on again.",
                });
              }
            }}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Consolidation</p>
            <p className="text-xs text-muted-foreground">
              {!advisory
                ? "Available once Advisory is on — it extends Advisory and is charged separately."
                : singleClient
                  ? "Not available — this organisation has a single client, and consolidation only means something across more than one."
                  : `Charged separately. Adds ${groupCards("consolidation").map(cardLabel).join(", ") || CARD_GROUP_LABEL.consolidation} for every client.`}
            </p>
          </div>
          <Switch
            checked={consolidation}
            disabled={!canEdit || !advisory || singleClient}
            onCheckedChange={setConsolidation}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Branding</p>
            <p className="text-xs text-muted-foreground">
              {!advisory
                ? "Available once Advisory is on — it extends Advisory and is charged separately."
                : "Charged separately. Lets each client have its own logo on the monthly management report. Switching it off hides the logos; nothing is deleted, and they return if it comes back on."}
            </p>
          </div>
          <Switch
            checked={branding}
            disabled={!canEdit || !advisory}
            onCheckedChange={(v) => {
              setBranding(v);
              if (!v) {
                toast.message("Logos are kept", {
                  description:
                    "Any logo already uploaded stays in storage and simply stops being used. It comes back if Branding is switched on again.",
                });
              }
            }}
          />
        </div>
      </div>

      {canEdit ? (
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !dirty}>
          {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save purchase
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Read-only — contact support to change what this organisation has bought.
        </p>
      )}

      <OrgTrialBlock firmId={firmId} purchase={purchase} canEdit={canEdit} />
    </section>
  );
}

/**
 * A trial on top of the purchase: it grants Advisory (and Consolidation) until a
 * date, and is kept entirely separate from what has been bought so that when it
 * ends the organisation reverts to exactly its purchase. Every change goes
 * through public.set_org_trial, which re-checks the second factor and super
 * admin, insists on a reason, and writes an audit row.
 */
function OrgTrialBlock({
  firmId,
  purchase,
  canEdit,
}: {
  firmId: string;
  purchase: OrgPurchase;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const saveTrial = useServerFn(saveOrgTrial);
  const savePurchase = useServerFn(saveOrgPurchase);
  const status = trialStatus(purchase);

  const [open, setOpen] = useState(false);
  const [tAdvisory, setTAdvisory] = useState(purchase.trialAdvisory);
  const [tConsolidation, setTConsolidation] = useState(purchase.trialConsolidation);
  const [tBranding, setTBranding] = useState(purchase.trialBranding);
  const [endsAt, setEndsAt] = useState(
    purchase.trialEndsAt ? purchase.trialEndsAt.slice(0, 10) : "",
  );
  const [reason, setReason] = useState("");
  const [clearPurchased, setClearPurchased] = useState(true);

  // A trial of something the organisation has already bought grants nothing new
  // and nothing happens when it ends. Name the overlap plainly.
  const overlap = [
    tAdvisory && purchase.advisory ? "Advisory" : null,
    tConsolidation && purchase.consolidation ? "Consolidation" : null,
    tBranding && purchase.branding ? "Branding" : null,
  ].filter(Boolean) as string[];
  const overlapLabel = overlap.join(", ").replace(/, ([^,]*)$/, " and $1");

  const mut = useMutation({
    mutationFn: async (vars: {
      advisory: boolean;
      consolidation: boolean;
      branding: boolean;
      endsAt: string | null;
      clearPurchased?: boolean;
    }) => {
      // Clear the purchase first, so there is never a moment where the trial is
      // live while the purchase still grants everything anyway.
      if (vars.clearPurchased) {
        await savePurchase({
          data: {
            firmId,
            clientLimit: purchase.clientLimit,
            advisory: purchase.advisory && !vars.advisory,
            consolidation: purchase.consolidation && !vars.consolidation,
            branding: purchase.branding && !vars.branding,
            billingMode: purchase.billingMode,
          },
        });
      }
      return await saveTrial({
        data: {
          firmId,
          advisory: vars.advisory,
          consolidation: vars.consolidation,
          branding: vars.branding,
          endsAt: vars.endsAt,
          reason,
        },
      });
    },
    onSuccess: () => {
      toast.success("Trial updated");
      setOpen(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["org-purchase", firmId] });
      qc.invalidateQueries({ queryKey: ["org-purchases"] });
      qc.invalidateQueries({ queryKey: ["client-card-setup"] });
      qc.invalidateQueries({ queryKey: ["client-widgets"] });
      qc.invalidateQueries({ queryKey: ["effective-widgets"] });
      qc.invalidateQueries({ queryKey: ["client-branding"] });
      qc.invalidateQueries({ queryKey: ["report-logo"] });
      qc.invalidateQueries({ queryKey: ["client-org-trial"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the trial"),
  });

  const maxDate = new Date(Date.now() + TRIAL_MAX_DAYS * 86_400_000).toISOString().slice(0, 10);
  const minDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Trial</p>
          <p className="text-xs text-muted-foreground">
            For an organisation that has not bought Advisory yet. A trial never removes anything the
            organisation has purchased, and when it ends each client's ticked cards are remembered.
          </p>
        </div>
        {canEdit && !open && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {status.kind === "active" ? "Change trial" : "Start a trial"}
          </Button>
        )}
      </div>

      {status.kind === "none" && (
        <p className="text-sm text-muted-foreground">
          No trial. This organisation only has what it has purchased above.
        </p>
      )}
      {status.kind === "expired" && (
        <p className="text-sm text-muted-foreground">
          Trial ended {status.endLabel}. The organisation is back to its purchase; every client's
          ticked cards were kept.
        </p>
      )}
      {status.kind === "active" && (
        <p
          className={`text-sm ${
            status.warn
              ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300"
              : "text-muted-foreground"
          }`}
        >
          {status.grants} on trial until {status.endLabel}
          {status.warn
            ? ` — ${status.daysLeft <= 0 ? "ends today" : `${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"} left`}. Purchase it or the cards stop being available.`
            : "."}
        </p>
      )}

      {canEdit && open && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="trial-advisory">Advisory on trial</Label>
            <Switch
              id="trial-advisory"
              checked={tAdvisory}
              onCheckedChange={(v) => {
                setTAdvisory(v);
                if (!v) {
                  setTConsolidation(false);
                  setTBranding(false);
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="trial-consolidation">Consolidation on trial</Label>
            <Switch
              id="trial-consolidation"
              checked={tConsolidation}
              disabled={!tAdvisory}
              onCheckedChange={setTConsolidation}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="trial-branding">Branding on trial</Label>
              <p className="text-xs text-muted-foreground">
                A trial of Advisory does not include Branding unless it is ticked here.
              </p>
            </div>
            <Switch
              id="trial-branding"
              checked={tBranding}
              disabled={!tAdvisory}
              onCheckedChange={setTBranding}
            />
          </div>
          {overlap.length > 0 && (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">
                This organisation has already bought {overlapLabel}.
              </p>
              <p>
                A trial of something already purchased grants nothing new, and nothing changes when
                it ends. For the trial to mean anything, the purchase of {overlapLabel} has to be
                cleared.
              </p>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={clearPurchased}
                  onChange={(e) => setClearPurchased(e.target.checked)}
                />
                <span>
                  Clear the purchase of {overlapLabel} and start the trial in one step. Every
                  client's ticked cards are remembered, so buying it again later restores each
                  client exactly as it is now.
                </span>
              </label>
              {!clearPurchased && (
                <p className="font-medium">
                  Left ticked as purchased, this trial will be cosmetic — the cards stay available
                  after the end date.
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">

            <Label htmlFor="trial-ends">Ends</Label>
            <Input
              id="trial-ends"
              type="date"
              min={minDate}
              max={maxDate}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              At most {TRIAL_MAX_DAYS} days. The date is shown to you from the start, and warned
              about {TRIAL_WARN_DAYS} days before it lapses.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trial-reason">Reason</Label>
            <Input
              id="trial-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this organisation is being given a trial"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={mut.isPending || reason.trim().length < 3}
              onClick={() =>
                mut.mutate({
                  advisory: tAdvisory,
                  consolidation: tConsolidation,
                  branding: tBranding,
                  endsAt: endsAt || null,
                  clearPurchased: overlap.length > 0 && clearPurchased,
                })
              }

            >
              {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save trial
            </Button>
            {status.kind === "active" && (
              <Button
                size="sm"
                variant="outline"
                disabled={mut.isPending || reason.trim().length < 3}
                onClick={() =>
                  mut.mutate({
                    advisory: false,
                    consolidation: false,
                    branding: false,
                    endsAt: null,
                  })
                }
              >
                End trial now
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
