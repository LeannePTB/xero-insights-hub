import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientSubscription, openBillingPortal } from "@/lib/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CreditCard } from "lucide-react";
import { toast } from "sonner";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SubscriptionPanel({ clientId }: { clientId: string }) {
  const fetchSub = useServerFn(getClientSubscription);
  const openPortalFn = useServerFn(openBillingPortal);
  const q = useQuery({
    queryKey: ["client-subscription", clientId],
    queryFn: () => fetchSub({ data: { clientId } }),
  });

  const sub = q.data?.subscription;

  async function openPortal() {
    try {
      const r = await openPortalFn({
        data: { clientId, environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("error" in r) throw new Error(r.error);
      window.open(r.url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Could not open billing portal");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Subscription</h2>
      </div>

      {!sub ? (
        <p className="text-sm text-muted-foreground">
          No billing has been set up for this client. Contact your advisor to enable a subscription.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Plan</dt>
              <dd className="mt-0.5">{sub.plan_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <Badge variant="outline">{sub.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Due date</dt>
              <dd className="mt-0.5">{formatDate(sub.current_period_end)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Trial ends</dt>
              <dd className="mt-0.5">{formatDate(sub.trial_end)}</dd>
            </div>
          </dl>

          {sub.stripe_customer_id && (
            <Button variant="outline" size="sm" className="mt-4" onClick={openPortal}>
              Manage billing <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          )}
        </>
      )}
    </section>
  );
}
