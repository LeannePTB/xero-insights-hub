import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { adminUpdateBillingLifecycle } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
  "unpaid",
  "incomplete_expired",
] as const;

const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  trialing: "Billing not started yet",
  active: "Active",
  past_due: "Past due",
  canceled: "Cancelled",
  paused: "Suspended",
  unpaid: "Unpaid",
  incomplete_expired: "Incomplete — expired",
};

function dateInput(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function BillingLifecycleCard({
  firmId,
  subscription,
  isAlwaysFree,
  onChanged,
}: {
  firmId: string;
  subscription: {
    status?: string | null;
    trial_ends_at?: string | null;
    current_period_end?: string | null;
  } | null;
  isAlwaysFree: boolean;
  onChanged: () => void;
}) {
  const update = useServerFn(adminUpdateBillingLifecycle);
  const [status, setStatus] = useState(subscription?.status ?? "active");
  const [trialEnds, setTrialEnds] = useState(dateInput(subscription?.trial_ends_at));
  const [periodEnd, setPeriodEnd] = useState(dateInput(subscription?.current_period_end));
  const [alwaysFree, setAlwaysFree] = useState(isAlwaysFree);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setStatus(subscription?.status ?? "active");
    setTrialEnds(dateInput(subscription?.trial_ends_at));
    setPeriodEnd(dateInput(subscription?.current_period_end));
  }, [subscription?.status, subscription?.trial_ends_at, subscription?.current_period_end]);

  useEffect(() => setAlwaysFree(isAlwaysFree), [isAlwaysFree]);

  const alwaysFreeChanged = alwaysFree !== isAlwaysFree;
  const dirty =
    status !== (subscription?.status ?? "active") ||
    trialEnds !== dateInput(subscription?.trial_ends_at) ||
    periodEnd !== dateInput(subscription?.current_period_end) ||
    alwaysFreeChanged;

  const mutation = useMutation({
    mutationFn: () =>
      update({
        data: {
          firmId,
          status,
          trial_ends_at: trialEnds ? new Date(trialEnds).toISOString() : null,
          current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
          ...(alwaysFreeChanged
            ? { is_always_free: alwaysFree, always_free_reason: reason.trim() }
            : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Billing lifecycle saved");
      setReason("");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="space-y-4 rounded-lg border p-6">
      <div className="flex items-center gap-2">
        <ReceiptText className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Billing lifecycle</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        These fields record whether billing is active or has ended. They do not decide which cards
        the organisation has bought.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Billing starts on</Label>
          <Input
            type="date"
            value={trialEnds}
            onChange={(event) => setTrialEnds(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Billing only. Used when the status above is &quot;Billing not started yet&quot;: after this
            date the organisation counts as lapsed. Nothing to do with the Advisory trial on the
            purchase card above.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Billing period ends</Label>
          <Input
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used to determine when a past-due organisation lapses.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Always free</p>
            <p className="text-xs text-muted-foreground">
              Available only for the practice organisation and enforced in the database.
            </p>
          </div>
          <Switch checked={alwaysFree} onCheckedChange={setAlwaysFree} />
        </div>

        {alwaysFreeChanged && (
          <div className="space-y-1.5 md:col-span-2">
            <Label>Reason for changing always free</Label>
            <Input
              value={reason}
              maxLength={500}
              placeholder="Recorded in the audit log"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !dirty || (alwaysFreeChanged && reason.trim().length < 3)}
      >
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save billing lifecycle
      </Button>
    </section>
  );
}
