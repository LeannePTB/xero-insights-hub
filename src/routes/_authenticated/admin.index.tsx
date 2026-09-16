import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFirmsAdmin } from "@/lib/admin.functions";
import { listMyFirms } from "@/lib/firms.functions";
import { getMyContext } from "@/lib/roles.functions";
import { AddOrganisationDialog } from "@/components/admin/AddOrganisationDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, ShieldAlert, ArrowLeft, Eye, Users } from "lucide-react";
import { SuperAdminBadge } from "@/components/admin/SuperAdminOnly";
import { OrphanXeroConnectionsCard } from "@/components/admin/OrphanXeroConnectionsCard";


import { listOrganisationUsage, type OrganisationUsage } from "@/lib/admin-plan-usage.functions";
import { listSubscriptionStates } from "@/lib/subscription-state.functions";
import { listOrgPurchases, type OrgPurchase } from "@/lib/card-model.functions";
import { recordViewAs } from "@/lib/view-as.functions";
import { toast } from "sonner";
import type { SubscriptionState } from "@/lib/subscription-state";
import { trialStatus } from "@/lib/org-trial";



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

        {/* Xero request allowance now sits with the other Xero monitoring on
            Security & compliance, so usage and failures are read together. */}

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
            Organisation name, what each has bought, usage and billing state only. No balances or
            client data are visible from this page — enforced at the database level.
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
  const navigate = useNavigate();
  // Limits and usage for every visible organisation in one call.
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

  // Expiry, day counts and the consolidation add-on come from the database
  // (public.firm_subscription_state) — never recomputed here.
  const fetchStates = useServerFn(listSubscriptionStates);
  const statesQ = useQuery({
    queryKey: ["subscription-states", firmIds.join(",")],
    queryFn: () => fetchStates({ data: { firmIds } }),
    enabled: firmIds.length > 0,
  });
  const stateByFirm = new Map<string, SubscriptionState>(
    (statesQ.data?.states ?? []).map((st) => [st.firmId, st]),
  );

  // What each organisation has actually bought (org_subscription_options via
  // public.org_purchase). This is what
  // decides cards while the purchase + ticked-list model is live.
  const fetchPurchases = useServerFn(listOrgPurchases);
  const purchasesQ = useQuery({
    queryKey: ["admin-org-purchases", firmIds.join(",")],
    queryFn: () => fetchPurchases({ data: { firmIds } }),
    enabled: firmIds.length > 0,
  });
  const purchaseByFirm = new Map<string, OrgPurchase>(
    (purchasesQ.data?.purchases ?? []).map((p) => [p.firmId, p]),
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

  const empty = (firms ?? []).length === 0;

  const rows = (firms ?? []).map((f) => ({
    f,
    usage: usageByFirm.get(f.firm_id),
    state: stateByFirm.get(f.firm_id),
  }));

  return (
    <section className="space-y-3">
      <SectionTitle />

      {/* Table from 900px up */}
      <div className="hidden min-[900px]:block rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">Organisation</th>
              <th className="px-4 py-3 whitespace-nowrap">Plan</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ f, usage, state }) => (
              <tr
                key={f.firm_id}
                className="border-t hover:bg-muted/30 cursor-pointer align-top"
                onClick={() => navigate({ to: "/admin/firms/$firmId", params: { firmId: f.firm_id } })}
              >
                <td className="px-4 py-3">
                  <OrganisationCell
                    name={f.firm_name}
                    alwaysFree={f.is_always_free}
                    state={state}
                    subscriptionStatus={f.status}
                    unsetLodgementCycles={usage?.unsetLodgementCycles ?? 0}
                  />
                </td>
                <td className="px-4 py-3">
                  <PlanCell
                    usage={usage}
                    purchase={purchaseByFirm.get(f.firm_id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <RowActions firmId={f.firm_id} organisationName={f.firm_name} isSuper={isSuper} />
                  </div>
                </td>
              </tr>
            ))}
            {empty && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
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

      {/* Stacked cards below 900px */}
      <div className="min-[900px]:hidden space-y-3">
        {rows.map(({ f, usage, state }) => (
          <div
            key={f.firm_id}
            className="rounded-lg border bg-card p-4 space-y-3 cursor-pointer"
            onClick={() => navigate({ to: "/admin/firms/$firmId", params: { firmId: f.firm_id } })}
          >
            <div className="flex items-start justify-between gap-3">
              <OrganisationCell
                name={f.firm_name}
                alwaysFree={f.is_always_free}
                state={state}
                subscriptionStatus={f.status}
                unsetLodgementCycles={usage?.unsetLodgementCycles ?? 0}
              />
              <div onClick={(e) => e.stopPropagation()}>
                <RowActions firmId={f.firm_id} organisationName={f.firm_name} isSuper={isSuper} />
              </div>
            </div>
            <div className="text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan</div>
                <div className="mt-0.5">
                <PlanCell
                    usage={usage}
                    purchase={purchaseByFirm.get(f.firm_id)}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
        {empty && (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            <p>No organisations yet.</p>
            <div className="mt-3 flex justify-center">
              <AddOrganisationDialog onCreated={onCreated} variant="outline" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function OrganisationCell({
  name,
  alwaysFree,
  state,
  subscriptionStatus,
  unsetLodgementCycles,
}: {
  name: string;
  alwaysFree: boolean;
  state?: SubscriptionState;
  subscriptionStatus: string | null;
  unsetLodgementCycles: number;
}) {
  const status = abnormalStatus(state, subscriptionStatus);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 font-medium">
        <span>{name}</span>
        {status && <Badge variant={status.variant}>{status.label}</Badge>}
        {alwaysFree && <Badge variant="outline">always free</Badge>}
      </div>
      {unsetLodgementCycles > 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-3 w-3" />
          {unsetLodgementCycles} client{unsetLodgementCycles === 1 ? "" : "s"} need lodgement cycles
        </div>
      )}
    </div>
  );
}

function abnormalStatus(state: SubscriptionState | undefined, status: string | null) {
  if (state?.lapsed) return { label: "Lapsed", variant: "destructive" as const };
  if (status === "canceled") return { label: "Cancelled", variant: "destructive" as const };
  if (status === "past_due") return { label: "Past due", variant: "outline" as const };
  if (status === "paused") return { label: "Suspended", variant: "outline" as const };
  return null;
}

/**
 * What the organisation has bought.
 *
 * Under the purchase + ticked-list model this reads org_subscription_options
 * (through public.org_purchase) and nothing else. The old line here counted
 * legacy per-client settings, which stopped deciding anything when the model
 * went live.
 */
function PlanCell({
  usage,
  purchase,
}: {
  usage: OrganisationUsage | undefined;
  purchase: OrgPurchase | undefined;
}) {
  if (!purchase) {
    return (
      <div className="leading-tight">
        <div className="text-muted-foreground">—</div>
      </div>
    );
  }
    const consolidationBlocked = purchase.advisory && purchase.clientCount <= 1;
    return (
      <div className="leading-tight space-y-0.5">
        <div
          className={`whitespace-nowrap tabular-nums ${
            usage?.clientLimit != null && usage.clientsUsed != null && usage.clientsUsed > usage.clientLimit
              ? "font-medium text-destructive"
              : usage?.clientLimit != null && usage.clientsUsed != null && usage.clientsUsed === usage.clientLimit
                ? "font-medium text-amber-600 dark:text-amber-400"
                : ""
          }`}
        >
          {purchase.clientLimit >= 9999 ? "Unlimited" : purchase.clientLimit} client
          {purchase.clientLimit === 1 ? "" : "s"}
          {usage?.clientLimit != null && usage.clientsUsed != null && usage.clientsUsed > usage.clientLimit
            ? " · over limit"
            : usage?.clientLimit != null && usage.clientsUsed != null && usage.clientsUsed === usage.clientLimit
              ? " · at limit"
              : ""}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <OptionPill on={purchase.advisory} label="Advisory" />
          <OptionPill
            on={purchase.consolidation}
            label="Consolidation"
            offNote={
              !purchase.advisory
                ? "needs Advisory"
                : consolidationBlocked
                  ? "single client"
                  : undefined
            }
          />
        </div>
        <TrialLine purchase={purchase} />
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {purchase.billingMode === "external" ? "billed externally" : "billed with bookkeeping"}
        </div>
      </div>
    );
}

/** "Advisory on" / "Advisory off", with the reason it cannot be on when there is one. */
function OptionPill({ on, label, offNote }: { on: boolean; label: string; offNote?: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${
        on
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {label} {on ? "on" : "off"}
      {!on && offNote ? ` · ${offNote}` : ""}
    </span>
  );
}

function RowActions({
  firmId,
  organisationName,
  isSuper,
}: {
  firmId: string;
  organisationName: string;
  isSuper: boolean;
}) {
  const navigate = useNavigate();
  const record = useServerFn(recordViewAs);

  // Previewing is recorded before it starts. The database function is the
  // control (aal2 + super admin + an access path this person already holds);
  // if it refuses, no preview opens.
  async function startPreview() {
    try {
      await record({ data: { firmId, mode: "owner" } });
      navigate({ to: "/firms/$firmId", params: { firmId }, search: { viewAs: "owner" } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start the preview.");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button size="sm" variant="outline" className="h-8 px-2 text-xs" asChild>
        <Link to="/admin/firms/$firmId" params={{ firmId }}>
          Options &amp; members
        </Link>
      </Button>
      <Button size="sm" variant="outline" className="h-8 px-2 text-xs" asChild>
        <Link to="/firms/$firmId" params={{ firmId }}>
          <Users className="mr-1 h-3.5 w-3.5" /> Clients
        </Link>
      </Button>
      {isSuper && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          onClick={() => void startPreview()}
          aria-label={`View as ${organisationName}`}
        >
          <Eye className="mr-1 h-3.5 w-3.5" /> View As
        </Button>
      )}
    </div>
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

/**
 * An active trial and the exact date it ends, amber inside the warning window so
 * it is noticed before it lapses rather than after. Nothing shows when there is
 * no trial, which is every organisation today.
 */
function TrialLine({ purchase }: { purchase: OrgPurchase }) {
  const status = trialStatus(purchase);
  if (status.kind !== "active") return null;
  return (
    <div
      className={`text-xs ${
        status.warn ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"
      }`}
    >
      {status.grants} on trial · ends {status.endLabel}
      {status.warn
        ? status.daysLeft <= 0
          ? " · ends today"
          : ` · ${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"} left`
        : ""}
    </div>
  );
}
