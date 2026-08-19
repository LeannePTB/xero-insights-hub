import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFirmsAdmin } from "@/lib/admin.functions";
import { listMyFirms } from "@/lib/firms.functions";
import { getMyContext } from "@/lib/roles.functions";
import { AddOrganisationDialog } from "@/components/admin/AddOrganisationDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, ShieldAlert, ArrowLeft, Eye, MoreHorizontal, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SuperAdminBadge } from "@/components/admin/SuperAdminOnly";
import { XeroApiErrorsSheet } from "@/components/admin/XeroApiErrorsSheet";
import { OrphanXeroConnectionsCard } from "@/components/admin/OrphanXeroConnectionsCard";
import { listXeroScopeStatus } from "@/lib/xero/scope-status.functions";
import { listOrganisationUsage, type OrganisationUsage } from "@/lib/admin-plan-usage.functions";
import { usePlanLevels } from "@/hooks/usePlanLevels";



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

/** used / limit, coloured amber at the limit and red over it. */
function UsageCell({ used, limit }: { used: number | null; limit: number | null }) {
  if (used == null) return <span className="text-muted-foreground">—</span>;
  const limitLabel = limit == null ? "∞" : String(limit);
  const tone =
    limit == null ? "" : used > limit ? "text-destructive font-medium" : used === limit ? "text-amber-500 font-medium" : "";
  return (
    <span className={tone}>
      {used} / {limitLabel}
      {limit != null && used > limit ? " (over)" : ""}
    </span>
  );
}

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
          <div className="flex items-center gap-2">
            {isSuper && (
              <XeroApiErrorsSheet
                trigger={
                  <Button variant="outline" size="sm">
                    Xero API errors (7 days)
                  </Button>
                }
              />
            )}
            {isSuper && <AddOrganisationDialog onCreated={() => firmsQ.refetch()} />}
          </div>
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
          <OrphanXeroConnectionsCard
            firms={((firmsQ.data?.firms as FirmRow[] | undefined) ?? []).map((f) => ({
              id: f.firm_id,
              name: f.firm_name,
            }))}
          />
        )}

        {isSuper && (
          <p className="text-sm text-muted-foreground">
            Organisation name, tier, usage, billing and error counts only. No balances or client
            data are visible from this page — enforced at the database level.
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
  // One query for every connection the caller can see (RLS decides), grouped
  // by organisation — not a query per row.
  const fetchScopeStatus = useServerFn(listXeroScopeStatus);
  const scopeQ = useQuery({
    queryKey: ["xero-scope-status"],
    queryFn: () => fetchScopeStatus(),
  });
  const scopeHealth = (() => {
    const map = new Map<string, { missing: number; total: number }>();
    for (const c of scopeQ.data?.connections ?? []) {
      if (!c.firmId) continue;
      const cur = map.get(c.firmId) ?? { missing: 0, total: 0 };
      cur.total += 1;
      if (c.missingScopes.length > 0) cur.missing += 1;
      map.set(c.firmId, cur);
    }
    return map;
  })();

  // Plan labels come from the plan_levels catalogue, never a hardcoded map.
  const { all: planLevels } = usePlanLevels();
  const planLabel = (key: string | null) =>
    key ? planLevels.find((l) => l.scope === "firm" && l.key === key)?.label ?? key : "—";
  const dashboardLabel = (key: string) =>
    planLevels.find((l) => l.scope === "dashboard" && l.key === key)?.label ?? key;

  // Limits and dashboard tiers for every visible organisation in one call.
  const firmIds = (firms ?? []).map((f) => f.firm_id);
  const fetchUsage = useServerFn(listOrganisationUsage);
  const usageQ = useQuery({
    queryKey: ["admin-org-usage", firmIds.join(",")],
    queryFn: () => fetchUsage({ data: { firmIds } }),
    enabled: isSuper && firmIds.length > 0,
  });
  const usageByFirm = new Map<string, OrganisationUsage>(
    (usageQ.data?.usage ?? []).map((u) => [u.firmId, u]),
  );




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
              <th className="px-4 py-3">Organisation</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Clients</th>
              <th className="px-4 py-3">Xero files</th>
              <th className="px-4 py-3">Dashboards in use</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Next bill / trial</th>
              <th className="px-4 py-3">Xero permissions</th>
              <th className="px-4 py-3">Xero API errors (7 days)</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(firms ?? []).map((f) => {
              const usage = usageByFirm.get(f.firm_id);
              return (
                <tr key={f.firm_id} className="border-t">
                  <td className="px-4 py-3">
                    <span className="font-medium">{f.firm_name}</span>
                    {f.is_always_free && <Badge variant="outline" className="mt-1 ml-2">always free</Badge>}
                  </td>
                  <td className="px-4 py-3">{planLabel(f.tier)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <UsageCell used={usage?.clientsUsed ?? null} limit={usage?.clientLimit ?? null} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <UsageCell used={usage?.xeroFilesUsed ?? null} limit={usage?.xeroOrgLimit ?? null} />
                  </td>
                  <td className="px-4 py-3">
                    <DashboardsInUseCell usage={usage} label={dashboardLabel} />
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
                  <td className="px-4 py-3">
                    <XeroScopeHealthCell
                      missing={scopeHealth?.get(f.firm_id)?.missing}
                      total={scopeHealth?.get(f.firm_id)?.total}
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <XeroApiErrorsSheet
                      firmId={f.firm_id}
                      organisationName={f.firm_name}
                      trigger={
                        <button
                          type="button"
                          className={
                            f.recent_error_count > 0
                              ? "text-destructive font-medium underline underline-offset-4"
                              : "text-muted-foreground underline underline-offset-4"
                          }
                        >
                          {f.recent_error_count}
                        </button>
                      }
                    />
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
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
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

/** Effective dashboard tiers across the organisation's clients, e.g. "8 × Standard, 4 × Advisory". */
function DashboardsInUseCell({
  usage,
  label,
}: {
  usage: OrganisationUsage | undefined;
  label: (key: string) => string;
}) {
  if (!usage) return <span className="text-muted-foreground">—</span>;
  if (usage.clientsUsed === 0) return <span className="text-muted-foreground">no clients</span>;
  const parts = Object.entries(usage.dashboards)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${count} × ${label(key)}`);
  if (parts.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {parts.join(", ")}
      {usage.dashboardsPartial && <span className="text-muted-foreground"> (partial)</span>}
    </span>
  );
}

function XeroScopeHealthCell({ missing, total }: { missing?: number; total?: number }) {
  if (total === undefined) return <span className="text-muted-foreground">—</span>;
  if (!missing) return <span className="text-muted-foreground">{total} OK</span>;
  return (
    <span className="font-medium text-amber-500">
      {missing} of {total} need permissions
    </span>
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
