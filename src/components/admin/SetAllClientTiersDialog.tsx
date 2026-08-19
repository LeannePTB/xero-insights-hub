import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setAllClientTiers } from "@/lib/billing.functions";
import type { DashboardTier } from "@/lib/tiers";

/**
 * Bulk "set tier for all clients" for one organisation. Everything that
 * decides who may run this, which tiers are permitted and which clients are
 * skipped lives in `public.set_all_client_tiers`; this only collects input and
 * reports the real counts back.
 */
export function SetAllClientTiersDialog({
  firmId,
  clientCount,
  options,
}: {
  firmId: string;
  clientCount: number;
  /** Catalogue-driven, already filtered to what the plan permits. */
  options: { key: string; label: string }[];
}) {
  const qc = useQueryClient();
  const run = useServerFn(setAllClientTiers);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [tier, setTier] = useState<string>(options[0]?.key ?? "basic");
  const [reason, setReason] = useState("");
  const [includeBilled, setIncludeBilled] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      run({ data: { firmId, tier: tier as DashboardTier, includeBilled, reason } }),
    onSuccess: (r) => {
      const label = options.find((o) => o.key === r.tier)?.label ?? r.tier;
      toast.success(
        `${r.changed} changed, ${r.skippedBilled} skipped (on a paid or trial subscription), ${r.unchanged} already on ${label}.`,
      );
      qc.invalidateQueries({ queryKey: ["clients", firmId] });
      qc.invalidateQueries({ queryKey: ["client-billing"] });
      qc.invalidateQueries({ queryKey: ["client-widgets"] });
      qc.invalidateQueries({ queryKey: ["firm-plan-summary", firmId] });
      setOpen(false);
      setConfirming(false);
      setReason("");
    },
    onError: (e: any) => {
      setConfirming(false);
      toast.error(e?.message ?? "Nothing was changed.");
    },
  });

  const tierLabelText = options.find((o) => o.key === tier)?.label ?? tier;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={clientCount === 0}>
        <Layers className="mr-2 h-4 w-4" /> Set tier for all clients
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setConfirming(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set tier for all clients</DialogTitle>
            <DialogDescription>
              Applies one dashboard tier across this organisation. Clients that have no
              subscription are given the tier at no charge, and every change is recorded in the
              audit log.
            </DialogDescription>
          </DialogHeader>

          {confirming ? (
            <div className="space-y-4">
              <p className="text-sm">
                Set <strong>{tierLabelText}</strong> for up to <strong>{clientCount}</strong>{" "}
                client{clientCount === 1 ? "" : "s"} in this organisation
                {includeBilled
                  ? ", including clients on a paid or trial subscription"
                  : ". Clients on a paid or trial subscription will be skipped"}
                .
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirming(false)} disabled={mut.isPending}>
                  Back
                </Button>
                <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
                  {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Set tier for all clients
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Dashboard tier</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a dashboard" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.key} value={o.key}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bulk-tier-reason">Reason (recorded in the audit log)</Label>
                <Input
                  id="bulk-tier-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Rolling Advisory out to all clients"
                />
              </div>

              <label className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  checked={includeBilled}
                  onCheckedChange={(v) => setIncludeBilled(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Also change clients on a paid or trial subscription
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    This can downgrade someone in the middle of a paid subscription or a trial.
                    Leave it off unless you mean it.
                  </span>
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button disabled={reason.trim().length < 3} onClick={() => setConfirming(true)}>
                  Continue
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
