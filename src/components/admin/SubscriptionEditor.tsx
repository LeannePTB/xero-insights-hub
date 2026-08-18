import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminUpdateSubscription } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePlanLevels } from "@/hooks/usePlanLevels";

export const FIRM_STATUSES = ["trialing", "active", "past_due", "canceled", "paused"];

/** Display-only labels; the stored values are unchanged. */
export const FIRM_STATUS_LABEL: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Cancelled",
  paused: "Paused",
};

export function toDateInput(s: string | null | undefined) {
  if (!s) return "";
  return new Date(s).toISOString().slice(0, 10);
}

/** Shared plan editor used by the admin firm detail page and the organisation page. */
export function SubscriptionEditor({
  firmId,
  subscription,
  isAlwaysFree,
  onChanged,
  submitLabel = "Save subscription",
}: {
  firmId: string;
  subscription: any;
  isAlwaysFree: boolean;
  onChanged: () => void;
  submitLabel?: string;
}) {
  const updateFn = useServerFn(adminUpdateSubscription);
  const { levels } = usePlanLevels("firm");
  const [tier, setTier] = useState<string>(subscription?.tier ?? "starter");
  const [status, setStatus] = useState<string>(subscription?.status ?? "trialing");
  const [trialEnds, setTrialEnds] = useState<string>(toDateInput(subscription?.trial_ends_at));
  const [periodEnd, setPeriodEnd] = useState<string>(toDateInput(subscription?.current_period_end));
  const [cancelEnd, setCancelEnd] = useState<boolean>(!!subscription?.cancel_at_period_end);
  const [alwaysFree, setAlwaysFree] = useState<boolean>(!!isAlwaysFree);
  const [limitOverride, setLimitOverride] = useState<string>(
    subscription?.client_limit_override != null ? String(subscription.client_limit_override) : "",
  );

  // The parent often renders before its query resolves; resync once the real
  // subscription arrives so edits aren't made against placeholder values.
  useEffect(() => {
    setTier(subscription?.tier ?? "starter");
    setStatus(subscription?.status ?? "trialing");
    setTrialEnds(toDateInput(subscription?.trial_ends_at));
    setPeriodEnd(toDateInput(subscription?.current_period_end));
    setCancelEnd(!!subscription?.cancel_at_period_end);
    setLimitOverride(
      subscription?.client_limit_override != null ? String(subscription.client_limit_override) : "",
    );
  }, [
    subscription?.tier,
    subscription?.status,
    subscription?.trial_ends_at,
    subscription?.current_period_end,
    subscription?.cancel_at_period_end,
    subscription?.client_limit_override,
  ]);

  useEffect(() => setAlwaysFree(!!isAlwaysFree), [isAlwaysFree]);

  // Consolidation is an organisation add-on, saved on its own so the change is
  // audited independently of the rest of the plan form.
  const setConsolidationFn = useServerFn(adminSetFirmConsolidation);
  const [consolidation, setConsolidation] = useState<boolean>(!!subscription?.consolidation_enabled);
  useEffect(
    () => setConsolidation(!!subscription?.consolidation_enabled),
    [subscription?.consolidation_enabled],
  );
  const consolidationMut = useMutation({
    mutationFn: (enabled: boolean) => setConsolidationFn({ data: { firmId, enabled } }),
    onSuccess: (_r, enabled) => {
      toast.success(enabled ? "Consolidation tools enabled" : "Consolidation tools disabled");
      onChanged();
    },
    onError: (e: any, enabled) => {
      // Fail closed: revert the control to the last known state.
      setConsolidation(!enabled);
      toast.error(e?.message ?? "Could not update the add-on");
    },
  });

  // Keep the current value selectable even if its level was retired.
  const options = levels.filter((l) => l.enabled || l.key === tier);
  const selectedLevel = levels.find((l) => l.key === tier);

  const mut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          firmId,
          tier,
          status,
          trial_ends_at: trialEnds ? new Date(trialEnds).toISOString() : null,
          current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
          cancel_at_period_end: cancelEnd,
          is_always_free: alwaysFree,
          client_limit_override: limitOverride.trim() === "" ? null : Math.max(0, Number(limitOverride)),
        },
      }),
    onSuccess: () => {
      toast.success("Subscription updated");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Plan</Label>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
            <SelectContent>
              {options.map((l) => <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIRM_STATUSES.map((t) => <SelectItem key={t} value={t}>{FIRM_STATUS_LABEL[t] ?? t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Trial ends</Label>
          <Input type="date" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Next bill date</Label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Cancel at period end</p>
            <p className="text-xs text-muted-foreground">Subscription ends on the date above.</p>
          </div>
          <Switch checked={cancelEnd} onCheckedChange={setCancelEnd} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Always free</p>
            <p className="text-xs text-muted-foreground">Never charge this organisation regardless of plan.</p>
          </div>
          <Switch checked={alwaysFree} onCheckedChange={setAlwaysFree} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
          <div className="pr-4">
            <p className="text-sm font-medium">Consolidation tools</p>
            <p className="text-xs text-muted-foreground">
              Unlocks cross-client consolidation for this organisation, independent of the plan and
              of client tiers.
            </p>
          </div>
          <Switch
            checked={consolidation}
            disabled={consolidationMut.isPending || !subscription}
            onCheckedChange={(v) => {
              setConsolidation(v);
              consolidationMut.mutate(v);
            }}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Client limit override</Label>
          <Input
            type="number"
            min={0}
            value={limitOverride}
            placeholder={
              selectedLevel ? `Plan default: ${selectedLevel.client_limit >= 9999 ? "unlimited" : selectedLevel.client_limit}` : "Plan default"
            }
            onChange={(e) => setLimitOverride(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the plan default. Set a number to give this organisation its own client quota.
          </p>
        </div>
      </div>


      <div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
