import { useEffect, useMemo, useRef } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClient } from "@/lib/clients.functions";
import { getMyContext } from "@/lib/roles.functions";
import { getCardOrder, saveCardOrder } from "@/lib/dashboard-layout.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, LogOut, Loader2, HardHat, Building2 } from "lucide-react";
import { RevenueExpenseKpis } from "@/components/dashboard/RevenueExpenseKpis";
import { TaxLiabilityWidget } from "@/components/dashboard/TaxLiabilityWidget";
import { PnlWidget } from "@/components/dashboard/PnlWidget";
import { BreakevenWidget } from "@/components/dashboard/BreakevenWidget";
import { PayablesWidget } from "@/components/dashboard/PayablesWidget";
import { ReceivablesWidget } from "@/components/dashboard/ReceivablesWidget";
import { NotesCard } from "@/components/dashboard/NotesCard";
import { UnreconciledCard } from "@/components/dashboard/UnreconciledCard";
import { SortableCardGrid, type SortableCard } from "@/components/dashboard/SortableCardGrid";
import { TIER_LABEL, ALL_WIDGETS, type DashboardTier } from "@/lib/tiers";
import { getEffectiveWidgets } from "@/lib/tier-config.functions";

export const Route = createFileRoute("/_authenticated/clients/$clientId/")({
  head: () => ({ meta: [{ title: "Client dashboard — Traction Advisory" }] }),
  component: ClientDashboard,
});

function ClientDashboard() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchClient = useServerFn(getClient);
  const fetchCtx = useServerFn(getMyContext);
  const fetchWidgets = useServerFn(getEffectiveWidgets);
  const fetchOrder = useServerFn(getCardOrder);
  const saveOrderFn = useServerFn(saveCardOrder);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient({ data: { clientId } }),
  });

  const isAdvisor = ctxQ.data?.isAdvisor ?? false;
  const viewerEntry = ctxQ.data?.viewerClients.find((c) => c.id === clientId);
  const tier: DashboardTier = isAdvisor ? "investigate" : (viewerEntry?.tier ?? "basic");

  const widgetsQ = useQuery({
    queryKey: ["effective-widgets", clientId, tier],
    queryFn: () => fetchWidgets({ data: { clientId, tier } }),
    enabled: !!ctxQ.data && !isAdvisor,
  });
  // Advisors always see every widget, regardless of saved tier config.
  const widgets = isAdvisor ? ALL_WIDGETS : (widgetsQ.data?.widgets ?? []);

  const orderQ = useQuery({
    queryKey: ["card-order", clientId],
    queryFn: () => fetchOrder({ data: { clientId } }),
  });

  const saveMut = useMutation({
    mutationFn: (order: string[]) => saveOrderFn({ data: { clientId, order } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["card-order", clientId] }),
  });

  // Debounce saves
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleOrderChange(order: string[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMut.mutate(order), 400);
  }
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const client = clientQ.data?.client;
  const orgs: any[] = client?.client_xero_orgs ?? [];

  const cards = useMemo<SortableCard[]>(() => {
    if (!client) return [];
    const list: SortableCard[] = [
      { id: "notes", node: <NotesCard clientId={clientId} canEdit={isAdvisor} /> },
      { id: "unreconciled", node: <UnreconciledCard clientId={clientId} /> },
    ];
    for (const o of orgs) {
      const tenantId = o.xero_connections?.tenant_id;
      const tenantName = o.xero_connections?.tenant_name ?? "Unknown";
      if (!tenantId) continue;
      if (widgets.includes("revenue_kpis"))
        list.push({ id: `${o.id}:revenue_kpis`, node: <RevenueExpenseKpis tenantId={tenantId} tenantName={tenantName} /> });
      if (widgets.includes("tax_liability"))
        list.push({ id: `${o.id}:tax_liability`, node: <TaxLiabilityWidget tenantId={tenantId} tenantName={tenantName} /> });
      if (widgets.includes("pnl"))
        list.push({ id: `${o.id}:pnl`, node: <PnlWidget tenantId={tenantId} tenantName={tenantName} /> });
      if (widgets.includes("breakeven"))
        list.push({ id: `${o.id}:breakeven`, node: <BreakevenWidget tenantId={tenantId} tenantName={tenantName} /> });
      if (widgets.includes("payables"))
        list.push({ id: `${o.id}:payables`, node: <PayablesWidget tenantId={tenantId} tenantName={tenantName} /> });
      if (widgets.includes("receivables"))
        list.push({ id: `${o.id}:receivables`, node: <ReceivablesWidget tenantId={tenantId} tenantName={tenantName} /> });
    }
    return list;
  }, [client, clientId, isAdvisor, orgs, widgets]);

  if (ctxQ.isLoading || clientQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <div className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }
  if (clientQ.error) return <ErrorPage message={(clientQ.error as Error).message} />;
  if (!client) return <ErrorPage message="Client not found." />;

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
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            {isAdvisor && (
              <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
                <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> All clients</Link>
              </Button>
            )}
            <h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">{client.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {TIER_LABEL[tier]} dashboard · {orgs.length} Xero {orgs.length === 1 ? "org" : "orgs"}
            </p>
          </div>
          {isAdvisor && (
            <Button variant="outline" asChild className="shrink-0">
              <Link to="/clients/$clientId/settings" params={{ clientId }}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Link>
            </Button>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Tip: hover any card and grab the handle in its top-right corner to reorder. Your layout is saved automatically.
        </p>

        <div className="mt-3">
          {orgs.length === 0 ? (
            <div className="space-y-6">
              <NotesCard clientId={clientId} canEdit={isAdvisor} />
              <UnreconciledCard clientId={clientId} />
              <EmptyOrgs isAdvisor={isAdvisor} clientId={clientId} />
            </div>
          ) : (
            <SortableCardGrid
              cards={cards}
              savedOrder={orderQ.data?.order ?? []}
              onOrderChange={handleOrderChange}
            />
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
