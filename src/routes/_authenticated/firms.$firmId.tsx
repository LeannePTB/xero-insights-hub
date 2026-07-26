import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClients } from "@/lib/clients.functions";
import { getMyFirm } from "@/lib/firms.functions";
import { listTierSettings } from "@/lib/tier-config.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, ChevronRight, Loader2, Plus } from "lucide-react";
import { ALL_TIERS, TIER_LABEL, type DashboardTier } from "@/lib/tiers";
import { ClientHealthBadge } from "@/components/dashboard/ClientHealthBadge";
import { SubscriptionStatusBadge, subscriptionView } from "@/components/billing/SubscriptionStatusBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/firms/$firmId")({
  head: () => ({ meta: [{ title: "Organisation — Traction Advisory" }] }),
  component: FirmPage,
});

function FirmPage() {
  const { firmId } = Route.useParams();
  const navigate = useNavigate();
  const fetchFirm = useServerFn(getMyFirm);
  const fetchClients = useServerFn(listClients);
  const fetchTierSettings = useServerFn(listTierSettings);

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

  const tierSettingsQ = useQuery({
    queryKey: ["tier-settings"],
    queryFn: () => fetchTierSettings(),
    enabled: !!firmQ.data,
  });
  const enabledTiers = ALL_TIERS.filter((t) => tierSettingsQ.data?.enabled?.[t] ?? true);

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
  const clients = clientsQ.data?.clients ?? [];

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> All organisations</Link>
        </Button>

        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">{firm.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pick a client to open their dashboard.</p>
          </div>
          <Button asChild>
            <Link to="/clients/new" search={{ firmId } as any}>
              <Plus className="mr-2 h-4 w-4" /> New client
            </Link>
          </Button>
        </div>

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
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Due date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Tiers</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c: any) => {
                    const granted: DashboardTier[] = c.clientTiers?.length ? c.clientTiers : enabledTiers;
                    const view = subscriptionView(c.subscription ?? null);
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
                        <td className="px-5 py-4 text-muted-foreground">{view.plan}</td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">{view.due}</td>
                        <td className="px-5 py-4">
                          <SubscriptionStatusBadge sub={c.subscription ?? null} />
                          {view.sub && (
                            <div className="mt-1 text-[11px] text-muted-foreground">{view.sub}</div>
                          )}
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
                          <Link
                            to="/clients/$clientId"
                            params={{ clientId: c.id }}
                            className="inline-flex items-center text-muted-foreground hover:text-foreground"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
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
