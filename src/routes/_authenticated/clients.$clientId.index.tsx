import { useEffect, useMemo, useRef } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClient } from "@/lib/clients.functions";
import type { ReportBasis } from "@/components/dashboard/BasisSelect";
import { getMyContext } from "@/lib/roles.functions";
import { getCardOrder, saveCardOrder } from "@/lib/dashboard-layout.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, LogOut, Loader2, Building2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

import { TaxLiabilityWidget } from "@/components/dashboard/TaxLiabilityWidget";
import { SuperannuationWidget } from "@/components/dashboard/SuperannuationWidget";
import { PnlWidget } from "@/components/dashboard/PnlWidget";
import { BreakevenWidget } from "@/components/dashboard/BreakevenWidget";
import { PayablesWidget } from "@/components/dashboard/PayablesWidget";
import { ReceivablesWidget } from "@/components/dashboard/ReceivablesWidget";
import { NotesCard } from "@/components/dashboard/NotesCard";
import { UnreconciledCard } from "@/components/dashboard/UnreconciledCard";
import { SortableCardGrid, type SortableCard } from "@/components/dashboard/SortableCardGrid";
import { TIER_LABEL, ALL_WIDGETS, type DashboardTier } from "@/lib/tiers";
import { TransactionSearch } from "@/components/dashboard/TransactionSearch";
import { getEffectiveWidgets, listTierSettings } from "@/lib/tier-config.functions";

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
  const fetchTierSettings = useServerFn(listTierSettings);
  const fetchOrder = useServerFn(getCardOrder);
  const saveOrderFn = useServerFn(saveCardOrder);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient({ data: { clientId } }),
  });
  const tierSettingsQ = useQuery({ queryKey: ["tier-settings"], queryFn: () => fetchTierSettings() });

  const isAdvisor = ctxQ.data?.isAdvisor ?? false;
  const viewerEntry = ctxQ.data?.viewerClients.find((c) => c.id === clientId);
  // For advisors, pick the highest enabled tier so the label reflects what's actually turned on.
  const enabledOrder: DashboardTier[] = ["multi_company", "investigate", "advisory", "basic"];
  const advisorTier: DashboardTier =
    enabledOrder.find((t) => tierSettingsQ.data?.enabled?.[t]) ?? "investigate";
  const tier: DashboardTier = isAdvisor ? advisorTier : (viewerEntry?.tier ?? "basic");

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
  const reportBasis: ReportBasis = (client?.report_basis as ReportBasis) ?? "accrual";

  const updateBasisFn = useServerFn(updateClientReportBasis);
  const basisMut = useMutation({
    mutationFn: (basis: ReportBasis) => updateBasisFn({ data: { clientId, basis } }),
    onSuccess: (_d, basis) => {
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["xero-tax-buckets"] });
      qc.invalidateQueries({ queryKey: ["xero-pnl"] });
      toast.success(`Report basis set to ${basis === "cash" ? "Cash" : "Accrual"}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update basis"),
  });

  

  const cards = useMemo<SortableCard[]>(() => {
    if (!client) return [];
    const list: SortableCard[] = [
      { id: "notes", node: <NotesCard clientId={clientId} canEdit={isAdvisor} />, fullWidth: true },
      { id: "unreconciled", node: <UnreconciledCard clientId={clientId} /> },
    ];
    for (const o of orgs) {
      const tenantId = o.xero_connections?.tenant_id;
      const tenantName = o.xero_connections?.tenant_name ?? "Unknown";
      if (!tenantId) continue;
      if (widgets.includes("tax_liability")) {
        list.push({ id: `${o.id}:tax_liability`, node: <TaxLiabilityWidget tenantId={tenantId} tenantName={tenantName} basis={reportBasis} /> });
        list.push({ id: `${o.id}:super_liability`, node: <SuperannuationWidget tenantId={tenantId} tenantName={tenantName} /> });
      }
      if (widgets.includes("pnl"))
        list.push({ id: `${o.id}:pnl`, node: <PnlWidget tenantId={tenantId} tenantName={tenantName} basis={reportBasis} /> });
      if (widgets.includes("breakeven"))
        list.push({ id: `${o.id}:breakeven`, node: <BreakevenWidget tenantId={tenantId} tenantName={tenantName} clientId={clientId} /> });
      if (widgets.includes("payables"))
        list.push({ id: `${o.id}:payables`, node: <PayablesWidget tenantId={tenantId} tenantName={tenantName} clientId={clientId} /> });
      if (widgets.includes("receivables"))
        list.push({ id: `${o.id}:receivables`, node: <ReceivablesWidget tenantId={tenantId} tenantName={tenantName} clientId={clientId} /> });

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
          <BrandMark logoHeightClass="h-9" />

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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report basis</span>
              {isAdvisor ? (
                <BasisSelect
                  value={reportBasis}
                  onChange={(v) => basisMut.mutate(v)}
                  disabled={basisMut.isPending}
                />
              ) : (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {reportBasis}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Used by Tax liabilities and P&L. Other cards report on Accrual.
              </span>
            </div>
          </div>
          {isAdvisor && (
            <Button variant="outline" asChild className="shrink-0">
              <Link to="/clients/$clientId/settings" params={{ clientId }}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Link>
            </Button>
          )}
        </div>

        {isAdvisor && orgs.length > 0 && (
          <div className="mt-6">
            <TransactionSearch clientId={clientId} />
          </div>
        )}

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
