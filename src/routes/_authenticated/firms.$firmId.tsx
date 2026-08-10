import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClients, deleteClient } from "@/lib/clients.functions";
import { getMyFirm } from "@/lib/firms.functions";
import { getMyContext } from "@/lib/roles.functions";
import { listTierSettings } from "@/lib/tier-config.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, ChevronRight, CreditCard, Loader2, MoreHorizontal, Plus, Settings, Trash2 } from "lucide-react";
import { ALL_TIERS, TIER_LABEL, type DashboardTier } from "@/lib/tiers";
import { ClientHealthBadge } from "@/components/dashboard/ClientHealthBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionEditor } from "@/components/admin/SubscriptionEditor";

import { Badge } from "@/components/ui/badge";
import { firmPlanView, toneClasses } from "@/lib/firmPlans";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/firms/$firmId")({
  head: () => ({ meta: [{ title: "Organisation — Traction Advisory" }] }),
  component: FirmPage,
});


function FirmPage() {
  const { firmId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchFirm = useServerFn(getMyFirm);
  const fetchClients = useServerFn(listClients);
  const fetchTierSettings = useServerFn(listTierSettings);
  const fetchCtx = useServerFn(getMyContext);
  const removeClient = useServerFn(deleteClient);
  const [planOpen, setPlanOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const firmQ = useQuery({
    queryKey: ["my-firm", firmId],
    queryFn: () => fetchFirm({ data: { firmId } }),
    retry: false,
  });

  const clientsQ = useQuery({
    queryKey: ["clients", firmId],
    queryFn: () => fetchClients({ data: { firmId } }),
    enabled: !!firmQ.data,
  });

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const isSuper = ctxQ.data?.isSuperAdmin ?? false;

  const tierSettingsQ = useQuery({
    queryKey: ["tier-settings"],
    queryFn: () => fetchTierSettings(),
    enabled: !!firmQ.data,
  });
  const enabledTiers = ALL_TIERS.filter((t) => tierSettingsQ.data?.enabled?.[t] ?? true);

  const deleteMut = useMutation({
    mutationFn: (clientId: string) => removeClient({ data: { clientId } }),
    onSuccess: () => {
      toast.success("Client removed");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["clients", firmId] });
      qc.invalidateQueries({ queryKey: ["my-firm", firmId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not remove client"),
  });

  useEffect(() => {
    if (firmQ.error) {
      toast.error("You don't have access to that organisation.");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [firmQ.error, navigate]);

  if (firmQ.isLoading || !firmQ.data) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firm = firmQ.data.firm;
  const plan = firmQ.data.plan;
  const planV = firmPlanView({
    tier: plan.tier,
    status: plan.status,
    is_always_free: plan.isAlwaysFree,
    trial_ends_at: plan.trialEndsAt,
    current_period_end: plan.currentPeriodEnd,
  });
  const clients = clientsQ.data?.clients ?? [];
  const atLimit = plan.clientCount >= plan.clientLimit;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> All organisations</Link>
        </Button>

        <div>
          <h1 className="font-display text-3xl font-semibold">{firm.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clients for this organisation. Add or remove them here.
          </p>
        </div>

        {/* Plan & subscription */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> Plan &amp; subscription
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">{planV.planLabel}</Badge>
                <Badge variant="outline" className={toneClasses(planV.statusTone)}>{planV.statusLabel}</Badge>
                <span className="text-muted-foreground tabular-nums">
                  {plan.clientCount} of {plan.clientLimit} clients used
                </span>
                {planV.dueLabel && <span className="text-muted-foreground">· {planV.dueLabel}</span>}
              </div>
            </div>
            {isSuper ? (
              <Button variant="outline" size="sm" onClick={() => setPlanOpen(true)}>
                <Settings className="mr-2 h-4 w-4" /> Edit plan
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Contact support to change this plan.</p>
            )}
          </div>
        </div>

        {/* Add client */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Clients</h2>
          <div className="flex items-center gap-3">
            {atLimit && (
              <span className="text-xs text-muted-foreground">
                Client limit reached — upgrade the plan to add more.
              </span>
            )}
            <Button asChild={!atLimit} disabled={atLimit}>
              {atLimit ? (
                <span><Plus className="mr-2 h-4 w-4" /> New client</span>
              ) : (
                <Link to="/clients/new" search={{ firmId } as any}>
                  <Plus className="mr-2 h-4 w-4" /> New client
                </Link>
              )}
            </Button>
          </div>
        </div>

        <Dialog open={planOpen} onOpenChange={setPlanOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Plan &amp; subscription</DialogTitle>
              <DialogDescription>{firm.name}</DialogDescription>
            </DialogHeader>
            <SubscriptionEditor
              firmId={firmId}
              subscription={{
                tier: plan.tier,
                status: plan.status,
                trial_ends_at: plan.trialEndsAt,
                current_period_end: plan.currentPeriodEnd,
                cancel_at_period_end: (plan as any).cancelAtPeriodEnd ?? false,
              }}
              isAlwaysFree={!!plan.isAlwaysFree}
              onChanged={() => {
                qc.invalidateQueries({ queryKey: ["my-firm", firmId] });
                setPlanOpen(false);
              }}
              submitLabel="Save plan"
            />
          </DialogContent>
        </Dialog>

        <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove client</DialogTitle>
              <DialogDescription>
                Remove “{pendingDelete?.name}” from {firm.name}? This deletes the client and all viewer
                access. Linked Xero organisations stay connected and can be reused.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMut.isPending}
                onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
              >
                {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove client
              </Button>
            </div>
          </DialogContent>
        </Dialog>



        <div className="mt-8">
          {clientsQ.isLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : clients.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">Create your first client</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                A client is a company you track. Each client can hold one or more Xero organisations.
              </p>
              <Button className="mt-6" asChild>
                <Link to="/clients/new" search={{ firmId } as any}>
                  <Plus className="mr-2 h-4 w-4" /> New client
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Tiers</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c: any) => {
                    const granted: DashboardTier[] = c.clientTiers?.length ? c.clientTiers : enabledTiers;
                    const tenantIds = (c.client_xero_orgs ?? [])
                      .map((o: any) => o.xero_connections?.tenant_id)
                      .filter(Boolean);
                    const tenantNames = (c.client_xero_orgs ?? [])
                      .map((o: any) => o.xero_connections?.tenant_name)
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <tr key={c.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-4">
                          <Link
                            to="/clients/$clientId"
                            params={{ clientId: c.id }}
                            className="flex items-center gap-3 group"
                          >
                            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium leading-tight group-hover:text-primary transition-colors">
                                {c.name}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground truncate">
                                {tenantNames || "No Xero org linked"}
                              </div>
                              <ClientHealthBadge tenantId={tenantIds[0] ?? null} />
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {enabledTiers
                              .filter((t) => granted.includes(t))
                              .map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
                                >
                                  {TIER_LABEL[t]}
                                </span>
                              ))}
                            {granted.length === 0 && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to="/clients/$clientId"
                              params={{ clientId: c.id }}
                              className="inline-flex items-center text-muted-foreground hover:text-foreground"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${c.name}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to="/clients/$clientId" params={{ clientId: c.id }}>Open</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to="/clients/$clientId/settings" params={{ clientId: c.id }}>Settings</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    setPendingDelete({ id: c.id, name: c.name });
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Remove client
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          )}
        </div>
      </main>
    </div>
  );
}
