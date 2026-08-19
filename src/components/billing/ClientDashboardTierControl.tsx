import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getClientBilling, setClientDashboardTier } from "@/lib/billing.functions";
import { getAllowedTiersForClient } from "@/lib/plan-tiers.functions";
import { usePlanLevels } from "@/hooks/usePlanLevels";
import { tierLabel, type DashboardTier } from "@/lib/tiers";

/**
 * Which dashboard a client sees. Lives with the other "what this client sees"
 * settings — the billing state (comps, trials, Stripe) stays in the
 * Subscription card. Choices come from the plan_levels catalogue, filtered to
 * what the organisation's plan permits; nothing is recomputed here.
 */
export function ClientDashboardTierControl({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const fetchBilling = useServerFn(getClientBilling);
  const fetchAllowed = useServerFn(getAllowedTiersForClient);
  const setTier = useServerFn(setClientDashboardTier);

  const [draft, setDraft] = useState<DashboardTier | null>(null);

  const billingQ = useQuery({
    queryKey: ["client-billing", clientId],
    queryFn: () => fetchBilling({ data: { clientId } }),
    staleTime: 0,
  });
  const allowedQ = useQuery({
    queryKey: ["plan-tiers", "client", clientId],
    queryFn: () => fetchAllowed({ data: { clientId } }),
  });
  const { levels } = usePlanLevels("dashboard");

  // Absence of a subscription row resolves to Standard in the entitlement
  // engine — mirror that rather than inventing a stored value.
  const storedTier = ((billingQ.data?.subscription?.dashboard_tier ?? "basic") as DashboardTier);
  const pendingTier = draft ?? storedTier;
  const allowed = allowedQ.data?.allowed ?? null;

  const options = levels
    .filter((l) => l.enabled || l.key === storedTier)
    .filter((l) => !allowed || allowed.includes(l.key) || l.key === storedTier);

  const mut = useMutation({
    mutationFn: (tier: DashboardTier) => setTier({ data: { clientId, tier } }),
    onSuccess: () => {
      toast.success("Dashboard tier updated");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["client-billing", clientId] });
      qc.invalidateQueries({ queryKey: ["client-widgets", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the dashboard tier"),
  });

  const ent = billingQ.data?.entitlement;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={pendingTier} onValueChange={(v) => setDraft(v as DashboardTier)}>
          <SelectTrigger className="h-9 w-64">
            <SelectValue placeholder="Select a dashboard" />
          </SelectTrigger>
          <SelectContent>
            {options.map((l) => (
              <SelectItem key={l.key} value={l.key}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={mut.isPending || billingQ.isLoading || pendingTier === storedTier}
          onClick={() => mut.mutate(pendingTier)}
        >
          Save tier
        </Button>
        {ent?.tier && (
          <Badge variant="secondary">Currently seeing: {tierLabel(ent.tier)}</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Sets which dashboard this client sees. The organisation's plan controls capacity and which
        dashboards are available; billing stays in the Subscription card below.
      </p>
    </div>
  );
}
