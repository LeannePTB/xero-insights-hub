import { useState } from "react";
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
import { TIER_LABEL as FIRM_TIER_LABEL } from "@/lib/firmPlans";

export const FIRM_TIERS = ["starter", "growth", "scale", "firm", "free", "legacy"] as const;
export const FIRM_STATUSES = ["trialing", "active", "past_due", "canceled", "paused"];

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
  const [tier, setTier] = useState<string>(subscription?.tier ?? "starter");
  const [status, setStatus] = useState<string>(subscription?.status ?? "trialing");
  const [trialEnds, setTrialEnds] = useState<string>(toDateInput(subscription?.trial_ends_at));
  const [periodEnd, setPeriodEnd] = useState<string>(toDateInput(subscription?.current_period_end));
  const [cancelEnd, setCancelEnd] = useState<boolean>(!!subscription?.cancel_at_period_end);
  const [alwaysFree, setAlwaysFree] = useState<boolean>(!!isAlwaysFree);

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
          <Label>Tier</Label>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIRM_TIERS.map((t) => <SelectItem key={t} value={t}>{FIRM_TIER_LABEL[t] ?? t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIRM_STATUSES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
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
            <p className="text-xs text-muted-foreground">Never charge this organisation regardless of tier.</p>
          </div>
          <Switch checked={alwaysFree} onCheckedChange={setAlwaysFree} />
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
