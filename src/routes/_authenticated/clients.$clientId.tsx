import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClient } from "@/lib/clients.functions";
import { getMyContext } from "@/lib/roles.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, LogOut, Loader2, HardHat, Building2 } from "lucide-react";
import { RevenueExpenseKpis } from "@/components/dashboard/RevenueExpenseKpis";
import { TaxLiabilityWidget } from "@/components/dashboard/TaxLiabilityWidget";
import { PnlWidget } from "@/components/dashboard/PnlWidget";
import { BreakevenWidget } from "@/components/dashboard/BreakevenWidget";
import { PayablesWidget } from "@/components/dashboard/PayablesWidget";
import { TIER_WIDGETS, TIER_LABEL, type DashboardTier, type WidgetKey } from "@/lib/tiers";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  head: () => ({ meta: [{ title: "Client dashboard — Traction Advisory" }] }),
  component: ClientDashboard,
});

function ClientDashboard() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const fetchClient = useServerFn(getClient);
  const fetchCtx = useServerFn(getMyContext);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient({ data: { clientId } }),
  });

  const isAdvisor = ctxQ.data?.isAdvisor ?? false;
  const viewerEntry = ctxQ.data?.viewerClients.find((c) => c.id === clientId);
  const tier: DashboardTier = isAdvisor ? "investigate" : (viewerEntry?.tier ?? "basic");
  const widgets = TIER_WIDGETS[tier];

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (ctxQ.isLoading || clientQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <div className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }
  if (clientQ.error) {
    return <ErrorPage message={(clientQ.error as Error).message} />;
  }
  const client = clientQ.data?.client;
  if (!client) return <ErrorPage message="Client not found." />;

  const orgs: any[] = client.client_xero_orgs ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <HardHat className="h-4.5 w-4.5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Traction</div>
              <div className="-mt-0.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-accent">Advisory</div>
            </div>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            {isAdvisor && (
              <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
                <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> All clients</Link>
              </Button>
            )}
            <h1 className="font-display text-3xl font-semibold">{client.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {TIER_LABEL[tier]} dashboard · {orgs.length} Xero {orgs.length === 1 ? "org" : "orgs"}
            </p>
          </div>
          {isAdvisor && (
            <Button variant="outline" asChild>
              <Link to="/clients/$clientId/settings" params={{ clientId }}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-8">
          {orgs.length === 0 ? (
            <EmptyOrgs isAdvisor={isAdvisor} clientId={clientId} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {orgs.map((o) => {
                const tenantId = o.xero_connections?.tenant_id;
                const tenantName = o.xero_connections?.tenant_name ?? "Unknown";
                if (!tenantId) return null;
                return (
                  <div key={o.id} className="space-y-6">
                    {widgets.includes("revenue_kpis") && <RevenueExpenseKpis tenantId={tenantId} tenantName={tenantName} />}
                    {widgets.includes("tax_liability") && <TaxLiabilityWidget tenantId={tenantId} tenantName={tenantName} />}
                    {widgets.includes("pnl") && <PnlWidget tenantId={tenantId} tenantName={tenantName} />}
                    {widgets.includes("breakeven") && <BreakevenWidget tenantId={tenantId} tenantName={tenantName} />}
                    {widgets.includes("payables") && <PayablesWidget tenantId={tenantId} tenantName={tenantName} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyOrgs({ isAdvisor, clientId }: { isAdvisor: boolean; clientId: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
        <Building2 className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold">No Xero organisations linked yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {isAdvisor ? "Open settings to link a Xero org to this client." : "Ask your advisor to link a Xero org."}
      </p>
      {isAdvisor && (
        <Button className="mt-6" asChild>
          <Link to="/clients/$clientId/settings" params={{ clientId }}><Settings className="mr-2 h-4 w-4" /> Open settings</Link>
        </Button>
      )}
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      </div>
    </div>
  );
}
