import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClients } from "@/lib/clients.functions";
import { listFirmsForSuperAdmin, type FirmOverviewCard } from "@/lib/firms.functions";
import { getMyContext } from "@/lib/roles.functions";
import { getMyFirmAccess } from "@/lib/access.functions";
import { listTierSettings } from "@/lib/tier-config.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, Plus, Loader2, Building2, ChevronRight, SlidersHorizontal, Users, Activity, KeyRound, Shield, Lock } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { ALL_TIERS, TIER_LABEL, WIDGET_LABEL, type DashboardTier, type WidgetKey } from "@/lib/tiers";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Clients — Traction Advisory" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchClients = useServerFn(listClients);
  const fetchCtx = useServerFn(getMyContext);
  const fetchFirms = useServerFn(listFirmsForSuperAdmin);

  const fetchTierSettings = useServerFn(listTierSettings);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const isAdvisor = ctxQ.data?.isAdvisor ?? false;
  const isSuperAdmin = ctxQ.data?.isSuperAdmin ?? false;
  const viewerClients = ctxQ.data?.viewerClients ?? [];

  const tierSettingsQ = useQuery({
    queryKey: ["tier-settings"],
    queryFn: () => fetchTierSettings(),
    enabled: isAdvisor && !isSuperAdmin,
  });
  const enabledTiers = ALL_TIERS.filter((t) => tierSettingsQ.data?.enabled?.[t] ?? true);

  // Super-admins see firm cards. Regular advisors see their own client list.
  const clientsQ = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
    enabled: isAdvisor && !isSuperAdmin,
  });
  const firmsQ = useQuery({
    queryKey: ["firms-overview"],
    queryFn: () => fetchFirms(),
    enabled: isSuperAdmin,
  });

  // Auto-redirect viewers with exactly one client
  useEffect(() => {
    if (!ctxQ.data) return;
    if (!ctxQ.data.isAdvisor && ctxQ.data.viewerClients.length === 1) {
      navigate({ to: "/clients/$clientId", params: { clientId: ctxQ.data.viewerClients[0].id }, replace: true });
    }
  }, [ctxQ.data, navigate]);

  // Surface "?xero=connected" toast (when arriving here after a connect from /clients/new)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("xero") === "connected") {
      toast.success("Xero organisation connected");
      url.searchParams.delete("xero");
      window.history.replaceState({}, "", url.toString());
    }
    const err = url.searchParams.get("xero_error");
    if (err) {
      toast.error(`Xero connection failed: ${err}`);
      url.searchParams.delete("xero_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const clients = isAdvisor ? clientsQ.data?.clients ?? [] : viewerClients;
  const loading =
    ctxQ.isLoading ||
    (isSuperAdmin && firmsQ.isLoading) ||
    (isAdvisor && !isSuperAdmin && clientsQ.isLoading);

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
        {isAdvisor && <AccessBanner />}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">
              {isSuperAdmin ? "Businesses" : isAdvisor ? "Clients" : "Your dashboards"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSuperAdmin
                ? "Open your business to manage its clients. Other businesses are read-only."
                : isAdvisor
                ? "Pick a client to open their dashboard."
                : "Select a dashboard to view."}
            </p>
          </div>
          {isSuperAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to="/admin"><Shield className="mr-2 h-4 w-4" /> Admin</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/settings/account"><KeyRound className="mr-2 h-4 w-4" /> My account</Link>
              </Button>
            </div>
          )}
          {isAdvisor && !isSuperAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to="/settings/account"><KeyRound className="mr-2 h-4 w-4" /> My account</Link>
              </Button>
              <Button asChild>
                <Link to="/clients/new"><Plus className="mr-2 h-4 w-4" /> New client</Link>
              </Button>
            </div>
          )}
          {!isAdvisor && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to="/settings/account"><KeyRound className="mr-2 h-4 w-4" /> My account</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : isSuperAdmin ? (
            <FirmGrid firms={firmsQ.data?.firms ?? []} />
          ) : clients.length === 0 ? (
            <EmptyState isAdvisor={isAdvisor} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((c: any) => {
                const orgCount = isAdvisor ? (c.client_xero_orgs?.length ?? 0) : null;
                const granted: DashboardTier[] = isAdvisor
                  ? (c.grantedTiers ?? [])
                  : (c.tier ? [c.tier as DashboardTier] : []);
                const tierWidgets: Record<DashboardTier, WidgetKey[]> | undefined = c.tierWidgets;
                return (
                  <Link
                    key={c.id}
                    to="/clients/$clientId"
                    params={{ clientId: c.id }}
                    className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold leading-tight">{c.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isAdvisor
                        ? ((c.client_xero_orgs ?? [])
                            .map((o: any) => o.xero_connections?.tenant_name)
                            .filter(Boolean)
                            .join(", ") || "No Xero org linked")
                        : `Tier: ${TIER_LABEL[c.tier as DashboardTier] ?? c.tier}`}
                    </p>

                    {tierWidgets && (
                      <div className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                        {enabledTiers.map((t) => {
                          const isOn = granted.includes(t);
                          const widgets = tierWidgets[t] ?? [];
                          return (
                            <div
                              key={t}
                              className={`flex items-baseline gap-2 text-[11px] leading-snug ${
                                isOn ? "text-foreground" : "text-muted-foreground/60"
                              }`}
                            >
                              <span
                                className={`shrink-0 font-semibold uppercase tracking-wider ${
                                  isOn ? "text-primary" : ""
                                }`}
                              >
                                {TIER_LABEL[t]}
                                {isOn ? " ●" : ""}
                              </span>
                              <span className="truncate">
                                {widgets.length
                                  ? widgets.map((w) => WIDGET_LABEL[w]).join(" · ")
                                  : "—"}
                              </span>
                            </div>
                          );
                        })}
                        {isAdvisor && granted.length === 0 && (
                          <p className="pt-1 text-[10px] italic text-muted-foreground/70">
                            No viewers assigned yet
                          </p>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FirmGrid({ firms }: { firms: FirmOverviewCard[] }) {
  if (firms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center text-muted-foreground">
        No businesses yet.
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {firms.map((f) => {
        const inner = (
          <>
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              {f.isOwn ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground/60" />
              )}
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold leading-tight">{f.name}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary" className="capitalize">
                {f.tier ?? "no plan"}
              </Badge>
              <span className="text-muted-foreground">
                {f.clientCount} {f.clientCount === 1 ? "client" : "clients"}
              </span>
              {!f.isOwn && (
                <Badge variant="outline" className="ml-auto">read-only</Badge>
              )}
            </div>
          </>
        );
        const base =
          "flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]";
        if (f.isOwn) {
          return (
            <Link
              key={f.id}
              to="/firms/$firmId"
              params={{ firmId: f.id }}
              className={`group ${base} transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md`}
            >
              {inner}
            </Link>
          );
        }
        return (
          <div key={f.id} className={`${base} opacity-80`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ isAdvisor }: { isAdvisor: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
        <Building2 className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold">
        {isAdvisor ? "Create your first client" : "No dashboards assigned yet"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {isAdvisor
          ? "A client is a company you track. Each client can hold one or more Xero organisations."
          : "Your advisor hasn't granted you access to any dashboards yet."}
      </p>
      {isAdvisor && (
        <Button className="mt-6" asChild>
          <Link to="/clients/new"><Plus className="mr-2 h-4 w-4" /> New client</Link>
        </Button>
      )}
    </div>
  );
}

function AccessBanner() {
  const fetchAccess = useServerFn(getMyFirmAccess);
  const q = useQuery({ queryKey: ["my-firm-access"], queryFn: () => fetchAccess() });
  if (!q.data || q.data.state === "no_firm" || q.data.state === "ok") return null;

  if (q.data.state === "trial") {
    return (
      <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm flex items-center justify-between gap-3">
        <span>
          Trial: <strong>{q.data.trialDaysLeft}</strong> day{q.data.trialDaysLeft === 1 ? "" : "s"} left.
          You're on the <strong className="capitalize">{q.data.tier}</strong> plan
          ({q.data.connectionCount}/{q.data.connectionLimit} Xero files used).
        </span>
        <span className="text-muted-foreground text-xs">Billing setup coming soon.</span>
      </div>
    );
  }

  // locked
  return (
    <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      <p className="font-medium text-destructive">Subscription not active</p>
      <p className="text-muted-foreground mt-1">
        {q.data.reason === "trial_expired"
          ? "Your trial has ended."
          : `Your subscription is ${q.data.reason ?? "inactive"}.`}{" "}
        Contact support to restore access. Your data is retained.
      </p>
    </div>
  );
}
