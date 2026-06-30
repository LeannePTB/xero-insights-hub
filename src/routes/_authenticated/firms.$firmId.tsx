import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClients } from "@/lib/clients.functions";
import { getMyFirm } from "@/lib/firms.functions";
import { listTierSettings } from "@/lib/tier-config.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, ChevronRight, Loader2, Plus } from "lucide-react";
import { ALL_TIERS, TIER_LABEL, WIDGET_LABEL, type DashboardTier, type WidgetKey } from "@/lib/tiers";
import { ClientHealthBadge } from "@/components/dashboard/ClientHealthBadge";
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((c: any) => {
                const granted: DashboardTier[] = c.grantedTiers ?? [];
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
                      {(c.client_xero_orgs ?? [])
                        .map((o: any) => o.xero_connections?.tenant_name)
                        .filter(Boolean)
                        .join(", ") || "No Xero org linked"}
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
                              <span className={`shrink-0 font-semibold uppercase tracking-wider ${isOn ? "text-primary" : ""}`}>
                                {TIER_LABEL[t]}{isOn ? " ●" : ""}
                              </span>
                              <span className="truncate">
                                {widgets.length ? widgets.map((w) => WIDGET_LABEL[w]).join(" · ") : "—"}
                              </span>
                            </div>
                          );
                        })}
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
