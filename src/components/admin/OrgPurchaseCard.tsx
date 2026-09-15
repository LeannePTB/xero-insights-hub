import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuperAdminChip } from "@/components/admin/SuperAdminOnly";
import { getOrgPurchase, saveOrgPurchase } from "@/lib/card-model.functions";
import { getMyContext } from "@/lib/roles.functions";
import { cardLabel, CARD_GROUP_LABEL } from "@/lib/card-labels";

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
  const [billingMode, setBillingMode] = useState<"bookkeeping" | "external">("bookkeeping");

  useEffect(() => {
    const p = q.data?.purchase;
    if (!p) return;
    setClientLimit(String(p.clientLimit));
    setAdvisory(p.advisory);
    setConsolidation(p.consolidation);
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
          billingMode,
        },
      }),
    onSuccess: () => {
      toast.success("Purchase saved");
      qc.invalidateQueries({ queryKey: ["org-purchase", firmId] });
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
            <SelectTrigger><SelectValue /></SelectTrigger>
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
              Switching it on ticks them for every client; switching it off hides them and keeps each
              client's ticks for when it comes back.
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
    </section>
  );
}
