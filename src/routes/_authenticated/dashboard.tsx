import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFirmsForSuperAdmin, listMyFirms, type FirmOverviewCard } from "@/lib/firms.functions";
import { getMyContext } from "@/lib/roles.functions";
import { getMyFirmAccess } from "@/lib/access.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, Loader2, Building2, ChevronRight, KeyRound, Shield, Lock } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

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

  const loading =
    ctxQ.isLoading ||
    (isSuperAdmin && superFirmsQ.isLoading) ||
    (isAdvisor && !isSuperAdmin && myFirmsQ.isLoading);

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
              {isAdvisor ? "Organisations" : "Your dashboards"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdvisor
                ? "Open an organisation to see its clients."
                : "Select a dashboard to view."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <FirmGrid firms={firms} />
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

function FirmGrid({ firms }: { firms: FirmOverviewCard[] }) {
  if (firms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center text-muted-foreground">
        You don't belong to any organisations yet.
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
