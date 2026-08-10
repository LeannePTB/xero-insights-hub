import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFirmsForSuperAdmin, listMyFirms, type FirmOverviewCard } from "@/lib/firms.functions";
import { firmPlanView, toneClasses } from "@/lib/firmPlans";
const planView = (f: FirmOverviewCard) => firmPlanView({ tier: f.tier, status: f.status, is_always_free: f.isAlwaysFree, trial_ends_at: f.trialEndsAt, current_period_end: f.currentPeriodEnd });

import { getMyContext } from "@/lib/roles.functions";
import { getMyFirmAccess } from "@/lib/access.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, Loader2, Building2, ChevronRight, KeyRound, Shield, Lock } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { AddOrganisationDialog } from "@/components/admin/AddOrganisationDialog";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Organisations — Traction Advisory" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getMyContext);
  const fetchAllFirms = useServerFn(listFirmsForSuperAdmin);
  const fetchMyFirms = useServerFn(listMyFirms);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const isAdvisor = ctxQ.data?.isAdvisor ?? false;
  const isSuperAdmin = ctxQ.data?.isSuperAdmin ?? false;
  const hasAdminAreaAccess = ctxQ.data?.hasAdminAreaAccess ?? isSuperAdmin;
  const viewerClients = ctxQ.data?.viewerClients ?? [];

  // Super-admins see every firm (own first, others read-only).
  // Regular advisors see only firms they belong to.
  const superFirmsQ = useQuery({
    queryKey: ["firms-overview"],
    queryFn: () => fetchAllFirms(),
    enabled: isSuperAdmin,
  });
  const myFirmsQ = useQuery({
    queryKey: ["my-firms"],
    queryFn: () => fetchMyFirms(),
    enabled: isAdvisor && !isSuperAdmin,
  });

  // Role-aware landing: send people straight to where they work.
  useEffect(() => {
    if (!ctxQ.data) return;
    // Super admins manage the platform from the Admin area.
    if (ctxQ.data.isSuperAdmin) {
      navigate({ to: "/admin", replace: true });
      return;
    }
    // Advisors / owners with a single organisation go straight into it.
    if (ctxQ.data.isAdvisor) {
      const mine = myFirmsQ.data?.firms ?? [];
      if (mine.length === 1) {
        navigate({ to: "/firms/$firmId", params: { firmId: mine[0].id }, replace: true });
      }
      return;
    }
    // Viewers with exactly one dashboard go straight to it.
    if (ctxQ.data.viewerClients.length === 1) {
      navigate({ to: "/clients/$clientId", params: { clientId: ctxQ.data.viewerClients[0].id }, replace: true });
    }
  }, [ctxQ.data, myFirmsQ.data, navigate]);


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
      toast.error(err);
      url.searchParams.delete("xero_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const firms: FirmOverviewCard[] = isSuperAdmin
    ? superFirmsQ.data?.firms ?? []
    : myFirmsQ.data?.firms ?? [];

  // While a redirect to a single destination is pending, show the spinner
  // rather than flashing a chooser with one card in it.
  const redirecting =
    isSuperAdmin ||
    (isAdvisor && (myFirmsQ.data?.firms?.length ?? 0) === 1) ||
    (!!ctxQ.data && !isAdvisor && viewerClients.length === 1);

  const loading =
    redirecting ||
    ctxQ.isLoading ||
    (isSuperAdmin && superFirmsQ.isLoading) ||
    (isAdvisor && !isSuperAdmin && myFirmsQ.isLoading);

  if (redirecting) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
              {isSuperAdmin
                ? "Subscriptions"
                : isAdvisor
                ? (firms.length === 1 ? "Your subscription" : "Your firms")
                : "Your dashboards"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSuperAdmin
                ? `${firms.length} organisation${firms.length === 1 ? "" : "s"} on the platform.`
                : isAdvisor
                ? "Manage your plan and open your firm to work with clients."
                : "Select a dashboard to view."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSuperAdmin && (
              <AddOrganisationDialog size="default" variant="outline" onCreated={() => superFirmsQ.refetch()} />
            )}
            {hasAdminAreaAccess && (
              <Button variant="outline" asChild>
                <Link to="/admin"><Shield className="mr-2 h-4 w-4" /> Admin</Link>
              </Button>
            )}
            <Button variant="outline" asChild>

              <Link to="/settings/account"><KeyRound className="mr-2 h-4 w-4" /> My account</Link>
            </Button>
          </div>
        </div>


        <div className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : isAdvisor ? (
            <FirmGrid firms={firms} isSuperAdmin={isSuperAdmin} />

          ) : viewerClients.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">No dashboards assigned yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Your advisor hasn't granted you access to any dashboards yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {viewerClients.map((c: any) => (
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
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FirmGrid({ firms, isSuperAdmin }: { firms: FirmOverviewCard[]; isSuperAdmin: boolean }) {
  if (firms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center text-muted-foreground">
        You don't belong to any organisations yet.
      </div>
    );
  }
  const single = firms.length === 1;
  return (
    <div className={single ? "" : "grid gap-4 md:grid-cols-2"}>
      {firms.map((f) => (
        <SubscriptionCard key={f.id} firm={f} isSuperAdmin={isSuperAdmin} wide={single} />
      ))}
    </div>
  );
}

function SubscriptionCard({
  firm: f,
  isSuperAdmin,
  wide,
}: {
  firm: FirmOverviewCard;
  isSuperAdmin: boolean;
  wide: boolean;
}) {
  const view = planView(f);
  const usedPct = Math.min(100, Math.round((f.clientCount / Math.max(1, f.clientLimit)) * 100));
  const barTone =
    usedPct >= 100 ? "bg-red-500"
    : usedPct >= 80 ? "bg-amber-500"
    : "bg-primary";

  return (
    <div className={`rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] ${wide ? "" : ""}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-semibold leading-tight">{f.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">{view.planLabel}</Badge>
              <Badge variant="outline" className={toneClasses(view.statusTone)}>
                {view.statusLabel}
              </Badge>
              {f.isAlwaysFree && <Badge variant="outline">Always free</Badge>}
              {!f.isOwn && <Badge variant="outline">read-only</Badge>}
            </div>
          </div>
        </div>
        {f.isOwn ? (
          <Button asChild>
            <Link to="/firms/$firmId" params={{ firmId: f.id }}>
              Open clients <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Lock className="mt-2 h-4 w-4 text-muted-foreground/60" />
        )}
      </div>

      <dl className={`mt-6 grid gap-6 ${wide ? "sm:grid-cols-3" : "grid-cols-2"}`}>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Clients</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {f.clientCount}
            <span className="text-sm font-normal text-muted-foreground"> / {f.clientLimit === 9999 ? "∞" : f.clientLimit}</span>
          </dd>
          {f.clientLimit !== 9999 && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full ${barTone} transition-all`} style={{ width: `${usedPct}%` }} />
            </div>
          )}
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {f.status === "trialing" ? "Trial ends" : "Renews"}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {view.dueLabel ? view.dueLabel.replace(/^(Renews |Trial ends |Was due |Ended )/, "") : "—"}
          </dd>
        </div>
        {wide && (
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</dt>
            <dd className="mt-1 text-lg font-semibold">{view.statusLabel}</dd>
          </div>
        )}
      </dl>

      {isSuperAdmin && f.isOwn && (
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/firms/$firmId" params={{ firmId: f.id }}>
              Manage subscription
            </Link>
          </Button>
        </div>
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
