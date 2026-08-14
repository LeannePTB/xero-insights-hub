import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFirmsAdmin } from "@/lib/admin.functions";
import { listMyFirms } from "@/lib/firms.functions";
import { getMyContext } from "@/lib/roles.functions";
import { AddOrganisationDialog } from "@/components/admin/AddOrganisationDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, ShieldAlert, ArrowLeft, Eye } from "lucide-react";
import { SuperAdminBadge } from "@/components/admin/SuperAdminOnly";


export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Organisations Admin — Traction Advisory" },
      { name: "description", content: "Manage Traction Advisory organisations, advisors and dashboard settings." },
      { property: "og:title", content: "Organisations Admin — Traction Advisory" },
      { property: "og:description", content: "Manage Traction Advisory organisations, advisors and dashboard settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type FirmRow = {
  firm_id: string;
  firm_name: string;
  is_always_free: boolean;
  firm_created_at: string;
  tier: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  connection_count: number;
  recent_error_count: number;
};

const TIER_LIMITS: Record<string, number> = { starter: 5, growth: 10, scale: 20, firm: 50, legacy: 9999 };

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

function AdminPage() {
  const fetchCtx = useServerFn(getMyContext);
  const fetchFirms = useServerFn(listFirmsAdmin);
  const fetchMyFirms = useServerFn(listMyFirms);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const isSuper = ctxQ.data?.isSuperAdmin ?? false;
  const hasAdminAreaAccess = ctxQ.data?.hasAdminAreaAccess ?? isSuper;
  const myFirmsQ = useQuery({
    queryKey: ["my-firms"],
    queryFn: () => fetchMyFirms(),
    enabled: hasAdminAreaAccess,
  });
  const firmsQ = useQuery({
    queryKey: ["admin-firms"],
    queryFn: () => fetchFirms(),
    enabled: isSuper,
  });

  if (ctxQ.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAdminAreaAccess) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Admin access required</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This area is for advisor or admin accounts. Your login is currently a viewer account.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {!isSuper && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
              </Button>
            )}

            <h1 className="text-xl font-semibold">Admin</h1>
            {isSuper ? <SuperAdminBadge /> : <Badge variant="outline">advisor admin</Badge>}
          </div>
          {isSuper && <AddOrganisationDialog onCreated={() => firmsQ.refetch()} />}
        </div>

      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <OrganisationsSection
          isSuper={isSuper}
          firms={firmsQ.data?.firms as FirmRow[] | undefined}
          firmsLoading={isSuper ? firmsQ.isLoading : myFirmsQ.isLoading}
          firmsError={isSuper ? firmsQ.error : myFirmsQ.error}
          myFirms={myFirmsQ.data?.firms ?? []}
          onCreated={() => firmsQ.refetch()}
        />

        {!isSuper && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Your account has advisor admin access. Organisation-wide billing, security documentation and compliance settings require the super-admin role.
          </div>
        )}

        {isSuper && (
          <p className="text-sm text-muted-foreground">
            Organisation name, tier, usage, billing and error counts only. No Xero org names, balances, or client data are visible from this page — enforced at the database level.
          </p>
        )}

      </main>
    </div>
  );
}

function OrganisationsSection({
  isSuper,
  firms,
  firmsLoading,
  firmsError,
  myFirms,
  onCreated,
}: {
  isSuper: boolean;
  firms: FirmRow[] | undefined;
  firmsLoading: boolean;
  firmsError: unknown;
  myFirms: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const ownFirmIds = new Set(myFirms.map((firm) => firm.id));

  if (firmsLoading) {
    return (
      <section className="space-y-3">
        <SectionTitle />
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading organisations…</div>
      </section>
    );
  }

  if (firmsError) {
    return (
      <section className="space-y-3">
        <SectionTitle />
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Organisations could not load</p>
            <p className="text-sm text-muted-foreground">{(firmsError as Error).message}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!isSuper) {
    return (
      <section className="space-y-3">
        <SectionTitle />
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Organisation name</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {myFirms.map((firm) => (
                <tr key={firm.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{firm.name}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/firms/$firmId" params={{ firmId: firm.id }}>Clients &amp; plan</Link>
                    </Button>
                  </td>

                </tr>
              ))}
              {myFirms.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No organisations yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionTitle />
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Organisation name</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Next bill / trial</th>
              <th className="px-4 py-3">Errors (7d)</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(firms ?? []).map((f) => {
              const limit = f.tier ? TIER_LIMITS[f.tier] ?? null : null;
              return (
                <tr key={f.firm_id} className="border-t">
                  <td className="px-4 py-3">
                    <span className="font-medium">{f.firm_name}</span>
                    {f.is_always_free && <Badge variant="outline" className="mt-1 ml-2">always free</Badge>}
                  </td>
                  <td className="px-4 py-3 capitalize">{f.tier ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {f.connection_count}{limit && limit < 9999 ? ` / ${limit}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={f.status === "active" || f.status === "trialing" ? "default" : "secondary"} className="capitalize">
                      {f.status ?? "—"}
                    </Badge>
                    {f.cancel_at_period_end && <Badge variant="outline" className="ml-1">cancelling</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.status === "trialing"
                      ? `trial ends ${fmtDate(f.trial_ends_at)}`
                      : fmtDate(f.current_period_end)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {f.recent_error_count > 0 ? (
                      <span className="text-destructive font-medium">{f.recent_error_count}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {ownFirmIds.has(f.firm_id) && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/firms/$firmId" params={{ firmId: f.firm_id }}>Clients</Link>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/firms/$firmId" params={{ firmId: f.firm_id }} search={{ viewAs: "owner" }}>
                          <Eye className="h-4 w-4 mr-1" /> View as
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/admin/firms/$firmId" params={{ firmId: f.firm_id }}>Plan &amp; members</Link>
                      </Button>


                    </div>
                  </td>
                </tr>
              );
            })}
            {(firms ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  <p>No organisations yet.</p>
                  <div className="mt-3 flex justify-center">
                    <AddOrganisationDialog onCreated={onCreated} variant="outline" />
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SectionTitle() {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-5 w-5 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Organisations</h2>
    </div>
  );
}
