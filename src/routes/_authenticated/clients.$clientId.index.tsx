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
import { ArrowLeft, Settings, LogOut, Loader2, Building2, AlertCircle } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { checkXeroConnection, startXeroConnect } from "@/lib/xero/connections.functions";
import { toast } from "sonner";
import { ConnectWithXeroButton } from "@/components/xero/ConnectWithXeroButton";

import { TaxLiabilityWidget } from "@/components/dashboard/TaxLiabilityWidget";
import { SuperannuationWidget } from "@/components/dashboard/SuperannuationWidget";
import { PnlWidget } from "@/components/dashboard/PnlWidget";
import { PeriodPerformanceWidget } from "@/components/dashboard/PeriodPerformanceWidget";
import { AccountingBreakevenWidget } from "@/components/dashboard/AccountingBreakevenWidget";
import { TrueBreakevenWidget } from "@/components/dashboard/TrueBreakevenWidget";
import { CashflowWidget } from "@/components/dashboard/CashflowWidget";
import { PayablesWidget } from "@/components/dashboard/PayablesWidget";
import { ReceivablesWidget } from "@/components/dashboard/ReceivablesWidget";
import { NotesCard } from "@/components/dashboard/NotesCard";
import { UnreconciledCard } from "@/components/dashboard/UnreconciledCard";
import { HealthWidget } from "@/components/dashboard/HealthWidget";
import { SortableCardGrid, type SortableCard } from "@/components/dashboard/SortableCardGrid";
import { TIER_LABEL, ALL_WIDGETS, type DashboardTier } from "@/lib/tiers";
import { TransactionSearch } from "@/components/dashboard/TransactionSearch";
import { getEffectiveWidgets, listTierSettings } from "@/lib/tier-config.functions";
import { UpgradeOptions } from "@/components/dashboard/UpgradeOptions";

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
  const overrides: Record<string, boolean> = (client?.basis_overrides as Record<string, boolean>) ?? {};
  // Defaults: tax_liability ON (preserves current behaviour); everything else OFF.
  const DEFAULT_ON: Record<string, boolean> = { tax_liability: true };
  function basisFor(widget: string): ReportBasis {
    const enabled = overrides[widget] ?? DEFAULT_ON[widget] ?? false;
    return enabled ? reportBasis : "accrual";
  }

  const { standardCards, advancedCards } = useMemo<{ standardCards: SortableCard[]; advancedCards: SortableCard[] }>(() => {
    const standard: SortableCard[] = [];
    const advanced: SortableCard[] = [];
    if (!client) return { standardCards: standard, advancedCards: advanced };
    for (const o of orgs) {
      const tenantId = o.xero_connections?.tenant_id;
      const tenantName = o.xero_connections?.tenant_name ?? "Unknown";
      if (!tenantId) continue;
      if (widgets.includes("receivables"))
        standard.push({ id: `${o.id}:receivables`, node: <ReceivablesWidget tenantId={tenantId} tenantName={tenantName} clientId={clientId} basis={basisFor("receivables")} /> });
      if (widgets.includes("payables"))
        standard.push({ id: `${o.id}:payables`, node: <PayablesWidget tenantId={tenantId} tenantName={tenantName} clientId={clientId} basis={basisFor("payables")} /> });
      if (widgets.includes("pnl"))
        standard.push({ id: `${o.id}:pnl`, node: <PnlWidget tenantId={tenantId} tenantName={tenantName} basis={basisFor("pnl")} /> });
      if (widgets.includes("tax_liability"))
        advanced.push({ id: `${o.id}:tax_liability`, node: <TaxLiabilityWidget tenantId={tenantId} tenantName={tenantName} basis={basisFor("tax_liability")} /> });
      if (widgets.includes("superannuation"))
        advanced.push({ id: `${o.id}:super_liability`, node: <SuperannuationWidget tenantId={tenantId} tenantName={tenantName} basis={basisFor("superannuation")} /> });
      if (widgets.includes("period_performance"))
        standard.push({ id: `${o.id}:period_performance`, node: <PeriodPerformanceWidget tenantId={tenantId} tenantName={tenantName} clientId={clientId} basis={basisFor("period_performance")} /> });
      if (widgets.includes("accounting_breakeven"))
        advanced.push({ id: `${o.id}:accounting_breakeven`, node: <AccountingBreakevenWidget tenantId={tenantId} tenantName={tenantName} clientId={clientId} basis={basisFor("accounting_breakeven")} /> });
      if (widgets.includes("true_breakeven"))
        advanced.push({ id: `${o.id}:true_breakeven`, node: <TrueBreakevenWidget tenantId={tenantId} tenantName={tenantName} clientId={clientId} basis={basisFor("true_breakeven")} /> });
      if (widgets.includes("cashflow"))
        advanced.push({ id: `${o.id}:cashflow`, node: <CashflowWidget tenantId={tenantId} tenantName={tenantName} /> });
    }
    return { standardCards: standard, advancedCards: advanced };
  }, [client, clientId, orgs, widgets, reportBasis, JSON.stringify(overrides)]);

  const showHealth = widgets.includes("health");
  const savedOrder = orderQ.data?.order ?? [];
  const standardIds = new Set(standardCards.map((c) => c.id));
  const advancedIds = new Set(advancedCards.map((c) => c.id));
  const standardSaved = savedOrder.filter((id) => standardIds.has(id));
  const advancedSaved = savedOrder.filter((id) => advancedIds.has(id));

  function handleOrderChangeSection(section: "standard" | "advanced", next: string[]) {
    const other = section === "standard" ? savedOrder.filter((id) => !standardIds.has(id)) : savedOrder.filter((id) => !advancedIds.has(id));
    // Keep standard before advanced in merged order
    const merged = section === "standard"
      ? [...next, ...savedOrder.filter((id) => advancedIds.has(id))]
      : [...savedOrder.filter((id) => standardIds.has(id)), ...next];
    handleOrderChange(merged);
  }

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
          </div>
          {isAdvisor && (
            <Button variant="outline" asChild className="shrink-0">
              <Link to="/clients/$clientId/settings" params={{ clientId }}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Link>
            </Button>
          )}
        </div>

        {orgs.length > 0 && (
          <XeroConnectionBanner
            orgs={orgs.map((o) => ({
              tenantId: o.xero_connections?.tenant_id as string | undefined,
              tenantName: o.xero_connections?.tenant_name as string | undefined,
            })).filter((o): o is { tenantId: string; tenantName: string | undefined } => !!o.tenantId)}
          />
        )}

        {isAdvisor && orgs.length > 0 && (
          <div className="mt-6">
            <TransactionSearch clientId={clientId} />
          </div>
        )}


        <div className="mt-3 space-y-6">
          {orgs.length === 0 ? (
            <>
              {showHealth && <HealthWidget />}
              <div className="grid gap-6 md:grid-cols-2">
                <NotesCard clientId={clientId} canEdit={isAdvisor} />
                <UnreconciledCard clientId={clientId} />
              </div>
              <EmptyOrgs isAdvisor={isAdvisor} clientId={clientId} />
            </>
          ) : (
            <>
              {showHealth && <HealthWidget />}
              <div className="grid gap-6 md:grid-cols-2">
                <NotesCard clientId={clientId} canEdit={isAdvisor} />
                <UnreconciledCard clientId={clientId} />
              </div>

              {standardCards.length > 0 && (
                <section>
                  <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Standard dashboard
                  </h2>
                  <SortableCardGrid
                    cards={standardCards}
                    savedOrder={standardSaved}
                    onOrderChange={(next) => handleOrderChangeSection("standard", next)}
                  />
                </section>
              )}

              {advancedCards.length > 0 && (
                <section>
                  <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Advisory
                  </h2>
                  <SortableCardGrid
                    cards={advancedCards}
                    savedOrder={advancedSaved}
                    onOrderChange={(next) => handleOrderChangeSection("advanced", next)}
                  />
                </section>
              )}
            </>
          )}
        </div>


        {!isAdvisor && orgs.length > 0 && (
          <UpgradeOptions clientId={clientId} clientName={client.name} currentTier={tier} />
        )}
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

function XeroConnectionBanner({ orgs }: { orgs: { tenantId: string; tenantName: string | undefined }[] }) {
  const check = useServerFn(checkXeroConnection);
  const startConnect = useServerFn(startXeroConnect);
  const checks = useQuery({
    queryKey: ["xero-conn-health", orgs.map((o) => o.tenantId).sort().join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        orgs.map(async (o) => ({ ...o, result: await check({ data: { tenantId: o.tenantId } }) })),
      );
      return results.filter((r) => r.result.needsReconnect);
    },
    staleTime: 60_000,
    retry: false,
  });

  async function handleReconnect() {
    const authWindow = window.open("about:blank", "_blank");
    try {
      const { authorizeUrl } = await startConnect({ data: { origin: window.location.origin } });
      if (authWindow) { authWindow.opener = null; authWindow.location.href = authorizeUrl; }
      else window.location.href = authorizeUrl;
    } catch (e: any) {
      authWindow?.close();
      toast.error(e?.message ?? "Could not start Xero reconnection");
    }
  }

  if (!checks.data || checks.data.length === 0) return null;
  const names = checks.data.map((c) => c.tenantName ?? "Xero org").join(", ");
  return (
    <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Xero connection needs to be reconnected</p>
        <p className="mt-1 text-sm">
          {names} can't refresh — sign in to Xero again to restore all dashboard cards.
        </p>
      </div>
      <ConnectWithXeroButton variant="reconnect" size="sm" onClick={handleReconnect} className="shrink-0" />
    </div>
  );
}
