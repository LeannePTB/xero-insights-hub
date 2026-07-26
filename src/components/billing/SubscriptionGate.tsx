import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientSubscription, openBillingPortal } from "@/lib/billing.functions";
import { getMyContext } from "@/lib/roles.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";

function daysFromNow(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function SubscriptionGate({
  clientId,
  children,
}: {
  clientId: string;
  children: ReactNode;
}) {
  const fetchSub = useServerFn(getClientSubscription);
  const fetchCtx = useServerFn(getMyContext);
  const openPortal = useServerFn(openBillingPortal);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const subQ = useQuery({
    queryKey: ["client-subscription", clientId],
    queryFn: () => fetchSub({ data: { clientId } }),
    staleTime: 30_000,
  });

  if (subQ.isLoading || ctxQ.isLoading) return <>{children}</>;

  const isSuperAdmin = (ctxQ.data as any)?.isSuperAdmin;
  if (isSuperAdmin) return <>{children}</>;

  const sub = subQ.data?.subscription;
  const graceDays = subQ.data?.gracePeriodDays ?? 7;

  // No sub row → allow (unbilled clients still work)
  if (!sub) return <>{children}</>;

  const status = sub.status as string;

  if (status === "cancelled") {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h2 className="font-display text-2xl font-semibold">Subscription cancelled</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Reactivate the subscription to view this dashboard.
        </p>
        <Button
          className="mt-4"
          onClick={async () => {
            try {
              const r = await openPortal({
                data: { clientId, environment: getStripeEnvironment(), returnUrl: window.location.href },
              });
              if ("error" in r) throw new Error(r.error);
              window.open(r.url, "_blank");
            } catch (e: any) {
              toast.error(e.message ?? "Could not open billing portal");
            }
          }}
        >
          Reactivate subscription
        </Button>
      </div>
    );
  }

  if (status === "past_due") {
    const since = sub.past_due_since ? new Date(sub.past_due_since).getTime() : Date.now();
    const daysPast = Math.floor((Date.now() - since) / (24 * 60 * 60 * 1000));
    if (daysPast >= graceDays) {
      return (
        <div className="mx-auto max-w-lg py-16 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <h2 className="font-display text-2xl font-semibold">Payment overdue</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your {graceDays}-day grace period has ended. Update your payment method to restore access.
          </p>
          <Button
            className="mt-4"
            onClick={async () => {
              const r = await openPortal({
                data: { clientId, environment: getStripeEnvironment(), returnUrl: window.location.href },
              });
              if ("error" in r) return toast.error(r.error);
              window.open(r.url, "_blank");
            }}
          >
            Update payment method
          </Button>
        </div>
      );
    }
    return (
      <>
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" />
          Payment failed. Update your payment method within {graceDays - daysPast} day
          {graceDays - daysPast === 1 ? "" : "s"} to keep access.
        </div>
        {children}
      </>
    );
  }

  if (status === "trialing") {
    const d = daysFromNow(sub.trial_end);
    return (
      <>
        {d !== null && d >= 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            Trial ends in {d} day{d === 1 ? "" : "s"}.
          </div>
        )}
        {children}
      </>
    );
  }

  return <>{children}</>;
}
