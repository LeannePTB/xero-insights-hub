import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listClientSubscriptionsAdmin,
  markClientFreeForever,
  unmarkClientFreeForever,
  startClientCheckout,
  cancelClientSubscription,
  openBillingPortal,
} from "@/lib/billing.functions";
import { getMyContext } from "@/lib/roles.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, ShieldAlert, ExternalLink, CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  EmbeddedCheckoutProvider, EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
const stripePromise = clientToken ? loadStripe(clientToken) : Promise.resolve(null);

const PLANS = [
  { id: "traction_standard_monthly", name: "Standard – A$99/mo" },
  { id: "traction_advisory_monthly", name: "Advisory – A$199/mo" },
];

export const Route = createFileRoute("/_authenticated/admin/billing")({
  head: () => ({
    meta: [
      { title: "Billing Admin — Traction Advisory" },
      { name: "description", content: "Manage client subscriptions and billing." },
    ],
  }),
  component: AdminBillingPage,
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function statusBadge(s: string | null | undefined) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800 border-emerald-200",
    trialing: "bg-sky-100 text-sky-800 border-sky-200",
    free_forever: "bg-slate-200 text-slate-700 border-slate-300",
    past_due: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };
  return <Badge variant="outline" className={s ? map[s] ?? "" : ""}>{s ?? "none"}</Badge>;
}

function AdminBillingPage() {
  const fetchCtx = useServerFn(getMyContext);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });

  if (ctxQ.isLoading) {
    return <AdminShell><div className="p-6"><Loader2 className="h-4 w-4 animate-spin" /></div></AdminShell>;
  }
  if (!(ctxQ.data as any)?.isSuperAdmin) {
    return (
      <AdminShell>
        <div className="mx-auto max-w-md py-16 text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="font-display text-2xl font-semibold">Super-admin required</h2>
          <p className="mt-2 text-sm text-muted-foreground">Billing admin is restricted to super-admins.</p>
        </div>
      </AdminShell>
    );
  }
  return <AdminShell><BillingContent /></AdminShell>;
}

function BillingContent() {
  const qc = useQueryClient();
  const listFn = useServerFn(listClientSubscriptionsAdmin);
  const markFF = useServerFn(markClientFreeForever);
  const unmarkFF = useServerFn(unmarkClientFreeForever);
  const cancelFn = useServerFn(cancelClientSubscription);
  const openPortalFn = useServerFn(openBillingPortal);
  const startFn = useServerFn(startClientCheckout);

  const q = useQuery({ queryKey: ["admin-billing"], queryFn: () => listFn() });
  const [filter, setFilter] = useState<string>("all");
  const [checkoutFor, setCheckoutFor] = useState<{ clientId: string; priceId: string } | null>(null);
  const [selectPlanFor, setSelectPlanFor] = useState<string | null>(null);
  const [chosenPlan, setChosenPlan] = useState<string>(PLANS[0].id);

  const rows = useMemo(() => {
    const all = (q.data as any)?.rows ?? [];
    if (filter === "all") return all;
    if (filter === "none") return all.filter((r: any) => !r.subscription);
    return all.filter((r: any) => r.subscription?.status === filter);
  }, [q.data, filter]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-billing"] });

  const markMutation = useMutation({
    mutationFn: async (clientId: string) => markFF({ data: { clientId } }),
    onSuccess: () => { toast.success("Marked as Free Forever"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const unmarkMutation = useMutation({
    mutationFn: async (clientId: string) => unmarkFF({ data: { clientId } }),
    onSuccess: () => { toast.success("Removed Free Forever"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancelMutation = useMutation({
    mutationFn: async (clientId: string) =>
      cancelFn({ data: { clientId, environment: getStripeEnvironment() } }),
    onSuccess: (r: any) => {
      if ("error" in r) return toast.error(r.error);
      toast.success("Subscription will cancel at period end");
      refresh();
    },
  });

  async function openPortal(clientId: string) {
    const r = await openPortalFn({
      data: { clientId, environment: getStripeEnvironment(), returnUrl: window.location.href },
    });
    if ("error" in r) return toast.error(r.error);
    window.open(r.url, "_blank");
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Billing</h1>
          <p className="text-sm text-muted-foreground">Manage client subscriptions.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="past_due">Past due</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="free_forever">Free forever</SelectItem>
            <SelectItem value="none">No billing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Firm</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const s = r.subscription;
                const due = s?.current_period_end ?? s?.trial_end;
                return (
                  <tr key={r.client_id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link to="/clients/$clientId" params={{ clientId: r.client_id }} className="font-medium hover:underline">
                        {r.client_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.firm_name ?? "—"}</td>
                    <td className="px-4 py-3">{s?.plan_name ?? "—"}</td>
                    <td className="px-4 py-3">{statusBadge(s?.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(due)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!s && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => { setChosenPlan(PLANS[0].id); setSelectPlanFor(r.client_id); }}>
                              Start subscription
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => markMutation.mutate(r.client_id)}>
                              Mark free forever
                            </Button>
                          </>
                        )}
                        {s?.subscription_type === "free_forever" && (
                          <Button size="sm" variant="ghost" onClick={() => unmarkMutation.mutate(r.client_id)}>
                            Remove free forever
                          </Button>
                        )}
                        {s?.stripe_customer_id && (
                          <Button size="sm" variant="outline" onClick={() => openPortal(r.client_id)}>
                            Portal <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                        {s?.stripe_subscription_id && s.status !== "cancelled" && (
                          <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(r.client_id)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No clients found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Plan picker */}
      <Dialog open={!!selectPlanFor} onOpenChange={(v) => !v && setSelectPlanFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a subscription</DialogTitle>
            <DialogDescription>Choose a plan. The next step opens a secure checkout.</DialogDescription>
          </DialogHeader>
          <Select value={chosenPlan} onValueChange={setChosenPlan}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLANS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectPlanFor(null)}>Cancel</Button>
            <Button onClick={() => {
              if (!selectPlanFor) return;
              setCheckoutFor({ clientId: selectPlanFor, priceId: chosenPlan });
              setSelectPlanFor(null);
            }}>
              <CreditCard className="mr-1 h-4 w-4" /> Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded checkout */}
      <Dialog open={!!checkoutFor} onOpenChange={(v) => { if (!v) { setCheckoutFor(null); refresh(); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
          </DialogHeader>
          {checkoutFor && (
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{
                fetchClientSecret: async () => {
                  const r = await startFn({
                    data: {
                      clientId: checkoutFor.clientId,
                      priceId: checkoutFor.priceId,
                      returnUrl: `${window.location.origin}/admin/billing`,
                      environment: getStripeEnvironment(),
                    },
                  });
                  if ("error" in r) throw new Error(r.error);
                  return r.clientSecret;
                },
              }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
