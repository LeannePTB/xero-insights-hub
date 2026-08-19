import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getClientBilling,
  setClientComp,
  setClientTrial,
} from "@/lib/billing.functions";
import { tierLabel, ALL_TIERS, type DashboardTier } from "@/lib/tiers";

const SOURCE_LABEL: Record<string, string> = {
  paid: "Paid",
  trial: "Trial",
  free_forever: "Comped",
  org_always_free: "Included with the organisation",
  none: "Free Standard",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ClientSubscriptionSection({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const fetchBilling = useServerFn(getClientBilling);
  const comp = useServerFn(setClientComp);
  const trial = useServerFn(setClientTrial);

  const [reason, setReason] = useState("");
  const [trialTier, setTrialTier] = useState<DashboardTier>("advisory");
  const [trialDays, setTrialDays] = useState("30");

  const q = useQuery({
    queryKey: ["client-billing", clientId],
    queryFn: () => fetchBilling({ data: { clientId } }),
    staleTime: 0,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["client-billing", clientId] });
    qc.invalidateQueries({ queryKey: ["client-widgets", clientId] });
    setReason("");
  }

  const compMut = useMutation({
    mutationFn: (comped: boolean) => comp({ data: { clientId, comped, reason } }),
    onSuccess: () => {
      toast.success("Subscription updated");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the subscription"),
  });

  const trialMut = useMutation({
    mutationFn: (start: boolean) =>
      trial({
        data: {
          clientId,
          tier: start ? trialTier : null,
          days: Number(trialDays) || 30,
          reason,
        },
      }),
    onSuccess: () => {
      toast.success("Trial updated");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the trial"),
  });


  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading subscription…</p>;

  const ent = q.data?.entitlement;
  const sub = q.data?.subscription ?? null;
  const isSuperAdmin = q.data?.isSuperAdmin ?? false;
  const expiry = formatDate(ent?.expiresAt ?? null);
  const isComped = sub?.subscription_type === "free_forever";
  const onTrial = ent?.source === "trial";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">{SOURCE_LABEL[ent?.source ?? "none"] ?? "Free Standard"}</Badge>
        <span className="text-sm font-medium">{tierLabel(ent?.tier ?? "basic")} dashboard</span>
        {ent?.inGrace && (
          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
            Payment overdue
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        The dashboard tier is set higher up this page, under “Dashboard tier”.
      </p>

      <p className="text-sm text-muted-foreground">
        {onTrial && expiry
          ? `Trial runs until ${expiry}. When it ends this client moves back to Standard automatically — the advisory cards simply stop appearing.`
          : ent?.source === "paid" && expiry
            ? `Renews ${expiry}. Prices are in AUD.`
            : ent?.source === "free_forever"
              ? "Comped: free Standard, no charge."
              : ent?.source === "org_always_free"
                ? "Included at no charge with this organisation."
                : "Free Standard dashboard."}
      </p>

      {sub?.comp_reason && isComped && (
        <p className="text-xs text-muted-foreground">Reason on file: {sub.comp_reason}</p>
      )}

      {isSuperAdmin && (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="outline" className="border-primary/50 text-primary">
              Super Admin View
            </Badge>
            <span className="text-sm font-medium">Comps and trials</span>
          </div>

          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="comp-reason">
            Reason (required — recorded in the audit log)
          </label>
          <Input
            id="comp-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Goodwill for onboarding delay"
            className="mb-3"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={isComped ? "outline" : "default"}
              disabled={reason.trim().length < 3 || compMut.isPending}
              onClick={() => compMut.mutate(!isComped)}
            >
              {isComped ? "Remove comp" : "Comp to free Standard"}
            </Button>

            <Select value={trialTier} onValueChange={(v) => setTrialTier(v as DashboardTier)}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_TIERS.filter((t) => t !== "basic").map((t) => (
                  <SelectItem key={t} value={t}>
                    {tierLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value.replace(/\D/g, ""))}
              className="h-9 w-20"
              aria-label="Trial length in days"
            />
            <span className="text-xs text-muted-foreground">days</span>

            <Button
              size="sm"
              variant="secondary"
              disabled={reason.trim().length < 3 || trialMut.isPending}
              onClick={() => trialMut.mutate(true)}
            >
              Start trial
            </Button>
            {onTrial && (
              <Button
                size="sm"
                variant="ghost"
                disabled={reason.trim().length < 3 || trialMut.isPending}
                onClick={() => trialMut.mutate(false)}
              >
                End trial now
              </Button>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Card payments are not switched on yet. Comps and trials are set here; paid subscriptions
        will be handled through the practice's own payment account once its keys are added.
      </p>
    </div>
  );
}
