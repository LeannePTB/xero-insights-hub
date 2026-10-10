import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { landingFor } from "@/lib/nav/landing";
import { getMyContext } from "@/lib/roles.functions";
import { listMyFirms } from "@/lib/firms.functions";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Building2, ChevronRight, KeyRound, Shield, Lock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Your workspaces — Traction Advisory" },
    { name: "description", content: "Open your Traction Advisory organisations and client dashboards." },
    { property: "og:title", content: "Your workspaces — Traction Advisory" },
    { property: "og:description", content: "Open your organisations and client dashboards." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getMyContext);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const fetchFirms = useServerFn(listMyFirms);
  const firmsQ = useQuery({ queryKey: ["nav-my-firms"], queryFn: () => fetchFirms() });
  const viewerClients = ctxQ.data?.viewerClients ?? [];
  const landing = ctxQ.data
    ? landingFor({
        isPlatformStaff: ctxQ.data.isPlatformStaff,
        isPracticeMember: ctxQ.data.isPracticeMember,
        firmIds: ctxQ.data.memberships.map((m) => m.firmId),
        firmClientCounts: Object.fromEntries((firmsQ.data?.firms ?? []).map((f) => [f.id, f.clientCount])),
        viewerClientIds: viewerClients.map((c) => c.id),
      })
    : null;

  // Role-aware landing. Routing only: every destination keeps its server check.
  useEffect(() => {
    if (!landing) return;
    if (landing.to === "/system" || landing.to === "/overview") navigate({ to: landing.to, replace: true });
    else if (landing.to === "/firms/$firmId/overview" || landing.to === "/firms/$firmId") navigate({ to: landing.to, params: { firmId: landing.firmId }, replace: true });
    else if (landing.to === "/clients/$clientId") navigate({ to: landing.to, params: { clientId: landing.clientId }, replace: true });
  }, [landing?.to, (landing as any)?.firmId, (landing as any)?.clientId, navigate]);

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

  if (!landing || (landing.to !== "chooser" && landing.to !== "none")) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <PageContainer>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Your dashboards</h1>
            <p className="mt-1 text-sm text-muted-foreground">Select a dashboard to view.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/settings/account"><KeyRound className="mr-2 h-4 w-4" /> My account</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8">
          {viewerClients.length === 0 ? (
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
      </PageContainer>
    </div>
  );
}

