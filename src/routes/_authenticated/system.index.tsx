import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ArrowDown, ArrowUp, Check, Loader2, Search, ShieldAlert } from "lucide-react";
import { listFirmsAdmin } from "@/lib/admin.functions";
import { listMyFirms } from "@/lib/firms.functions";
import { getMyContext } from "@/lib/roles.functions";
import { listOrganisationUsage, type OrganisationUsage } from "@/lib/admin-plan-usage.functions";
import { listSubscriptionStates } from "@/lib/subscription-state.functions";
import { listOrgPurchases, type OrgPurchase } from "@/lib/card-model.functions";
import { organisationOptionDisplay, organisationTrialEndLabel } from "@/lib/organisation-option-display";
import { filterAndSortOrganisations, organisationNeedsAttention, organisationStatus, type AdminOrganisationRow, type OrganisationFilter, type OrganisationSort, type SortDirection } from "@/lib/system-organisations";
import { AddOrganisationDialog } from "@/components/admin/AddOrganisationDialog";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SubscriptionState } from "@/lib/subscription-state";
import { PageContainer } from "@/components/PageContainer";

export const Route = createFileRoute("/_authenticated/system/")({
  head: () => ({ meta: [
    { title: "Organisations — Traction Advisory" },
    { name: "description", content: "Manage organisation plans, billing and platform metadata." },
    { property: "og:title", content: "Organisations — Traction Advisory" },
    { property: "og:description", content: "Manage organisation plans, billing and platform metadata." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OrganisationsPage,
});

type FirmRow = AdminOrganisationRow["firm"] & { connection_count?: number; recent_error_count?: number };

function OrganisationsPage() {
  const fetchCtx = useServerFn(getMyContext);
  const fetchFirms = useServerFn(listFirmsAdmin);
  const fetchMine = useServerFn(listMyFirms);
  const context = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const isSuper = context.data?.isSuperAdmin ?? false;
  const isPlatformStaff = context.data?.isPlatformStaff ?? false;
  const firms = useQuery({ queryKey: ["admin-firms"], queryFn: () => fetchFirms(), enabled: isSuper });
  const mine = useQuery({ queryKey: ["my-firms"], queryFn: () => fetchMine(), enabled: isPlatformStaff && !isSuper });

  if (context.isLoading) return <CenteredLoader />;
  if (!isPlatformStaff) return <AccessDenied />;

  return (
    <PageContainer width="full" className="space-y-5">
      <FirmPageHeader title="Organisations" actions={isSuper ? <AddOrganisationDialog onCreated={() => firms.refetch()} /> : undefined} />
      <p className="text-sm text-muted-foreground">Plan and usage metadata only — no client figures.</p>
      {isSuper ? (
        <AdminOrganisations firms={(firms.data?.firms ?? []) as FirmRow[]} loading={firms.isLoading} error={firms.error} />
      ) : (
        <MemberOrganisations firms={mine.data?.firms ?? []} loading={mine.isLoading} />
      )}
    </PageContainer>
  );
}

function AdminOrganisations({ firms, loading, error }: { firms: FirmRow[]; loading: boolean; error: unknown }) {
  const navigate = useNavigate();
  const firmIds = firms.map((firm) => firm.firm_id);
  const fetchUsage = useServerFn(listOrganisationUsage);
  const fetchStates = useServerFn(listSubscriptionStates);
  const fetchPurchases = useServerFn(listOrgPurchases);
  const usage = useQuery({ queryKey: ["admin-org-usage", firmIds.join(",")], queryFn: () => fetchUsage({ data: { firmIds } }), enabled: firmIds.length > 0 });
  const states = useQuery({ queryKey: ["subscription-states", firmIds.join(",")], queryFn: () => fetchStates({ data: { firmIds } }), enabled: firmIds.length > 0 });
  const purchases = useQuery({ queryKey: ["admin-org-purchases", firmIds.join(",")], queryFn: () => fetchPurchases({ data: { firmIds } }), enabled: firmIds.length > 0 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OrganisationFilter>("all");
  const [sort, setSort] = useState<OrganisationSort>("name");
  const [direction, setDirection] = useState<SortDirection>("asc");

  const rows = useMemo(() => {
    const usageMap = new Map<string, OrganisationUsage>((usage.data?.usage ?? []).map((value) => [value.firmId, value]));
    const stateMap = new Map<string, SubscriptionState>((states.data?.states ?? []).map((value) => [value.firmId, value]));
    const purchaseMap = new Map<string, OrgPurchase>((purchases.data?.purchases ?? []).map((value) => [value.firmId, value]));
    return filterAndSortOrganisations(firms.map((firm) => ({ firm, usage: usageMap.get(firm.firm_id), state: stateMap.get(firm.firm_id), purchase: purchaseMap.get(firm.firm_id) })), search, filter, sort, direction);
  }, [direction, filter, firms, purchases.data?.purchases, search, sort, states.data?.states, usage.data?.usage]);

  function open(row: AdminOrganisationRow) {
    void navigate({ to: "/system/organisations/$firmId", params: { firmId: row.firm.firm_id }, search: { tab: "overview" } });
  }
  function changeSort(next: OrganisationSort) {
    if (next === sort) setDirection((value) => value === "asc" ? "desc" : "asc");
    else { setSort(next); setDirection("asc"); }
  }

  if (loading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading organisations…</p>;
  if (error) return <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4"><ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" /><p className="text-sm">{(error as Error).message}</p></div>;

  return <section className="space-y-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full max-w-md"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search organisations…" className="pl-9" aria-label="Search organisations" /></div>
      <div className="flex flex-wrap gap-2" aria-label="Filter organisations">
        {([['all','All'],['trialling','Trialling'],['attention','Needs attention'],['overdue','Lapsed / overdue']] as const).map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{label}</Button>)}
      </div>
    </div>

    <div className="hidden overflow-x-auto rounded-md border lg:block">
      <table className="w-full min-w-[1050px] text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>
          <SortableHead label="Organisation" value="name" current={sort} direction={direction} onSort={changeSort} />
          <SortableHead label="Clients" value="clients" current={sort} direction={direction} onSort={changeSort} />
           <th className="px-3 py-2.5">Advisory</th><th className="px-3 py-2.5">Consolidation</th><th className="px-3 py-2.5">Branding</th><th className="px-3 py-2.5">White label</th>
          <SortableHead label="Billing" value="billing" current={sort} direction={direction} onSort={changeSort} />
          <SortableHead label="Trial ends" value="trial" current={sort} direction={direction} onSort={changeSort} />
          <SortableHead label="Needs attention" value="attention" current={sort} direction={direction} onSort={changeSort} />
        </tr></thead>
        <tbody>{rows.map((row) => <OrganisationTableRow key={row.firm.firm_id} row={row} onOpen={() => open(row)} />)}{rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No organisations match.</td></tr>}</tbody>
      </table>
    </div>
    <div className="grid gap-3 lg:hidden">{rows.map((row) => <OrganisationCard key={row.firm.firm_id} row={row} onOpen={() => open(row)} />)}{rows.length === 0 && <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">No organisations match.</p>}</div>
  </section>;
}

function SortableHead({ label, value, current, direction, onSort }: { label: string; value: OrganisationSort; current: OrganisationSort; direction: SortDirection; onSort: (value: OrganisationSort) => void }) {
  const Icon = direction === "asc" ? ArrowUp : ArrowDown;
  return <th className="px-3 py-2.5"><button className="inline-flex items-center gap-1 font-medium hover:text-foreground" onClick={() => onSort(value)}>{label}{current === value && <Icon className="h-3 w-3" />}</button></th>;
}

function OrganisationTableRow({ row, onOpen }: { row: AdminOrganisationRow; onOpen: () => void }) {
  return <tr className="cursor-pointer border-t hover:bg-muted/30 focus-within:bg-muted/30" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }}>
    <td className="px-3 py-3"><OrganisationName row={row} /></td><td className="px-3 py-3"><ClientUsage row={row} /></td>
    {(["advisory", "consolidation", "branding", "whiteLabel"] as const).map((key) => <td key={key} className="px-3 py-3"><OptionState row={row} option={key} /></td>)}
    <td className="px-3 py-3">{row.purchase?.billingMode === "external" ? "External" : row.purchase ? "Bookkeeping" : "—"}</td>
    <td className="px-3 py-3 tabular-nums">{row.purchase?.trialActive ? organisationTrialEndLabel(row.purchase.trialEndsAt) : ""}</td>
    <td className="px-3 py-3"><Attention row={row} /></td>
  </tr>;
}

function OrganisationCard({ row, onOpen }: { row: AdminOrganisationRow; onOpen: () => void }) {
  return <button onClick={onOpen} className="rounded-md border bg-card p-4 text-left hover:bg-muted/30"><OrganisationName row={row} /><dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
    <Fact label="Clients"><ClientUsage row={row} /></Fact><Fact label="Billing">{row.purchase?.billingMode === "external" ? "External" : row.purchase ? "Bookkeeping" : "—"}</Fact>
    <Fact label="Advisory"><OptionState row={row} option="advisory" /></Fact><Fact label="Consolidation"><OptionState row={row} option="consolidation" /></Fact><Fact label="Branding"><OptionState row={row} option="branding" /></Fact><Fact label="White label"><OptionState row={row} option="whiteLabel" /></Fact><Fact label="Trial ends">{row.purchase?.trialActive ? organisationTrialEndLabel(row.purchase.trialEndsAt) : "—"}</Fact><Fact label="Needs attention"><Attention row={row} /></Fact>
  </dl></button>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5">{children}</dd></div>; }
function OrganisationName({ row }: { row: AdminOrganisationRow }) { const status = organisationStatus(row); return <div className="flex flex-wrap items-center gap-2 font-medium">{row.firm.firm_name}{status && <Badge variant={status.tone === "bad" ? "destructive" : status.tone === "info" ? "info" : "secondary"}>{status.label}</Badge>}</div>; }
function ClientUsage({ row }: { row: AdminOrganisationRow }) { const used = row.usage?.clientsUsed; const limit = row.usage?.clientLimit; if (used == null || limit == null) return <>—</>; const over = used > limit; return <span className={over ? "font-medium text-destructive" : "tabular-nums"}>{used} / {limit >= 9999 ? "∞" : limit}{over ? " · over limit" : ""}</span>; }
function OptionState({ row, option }: { row: AdminOrganisationRow; option: "advisory" | "consolidation" | "branding" | "whiteLabel" }) { const state = row.purchase ? organisationOptionDisplay(row.purchase).find((item) => item.key === option) : undefined; return <span className="inline-flex items-center gap-1.5">{state?.on ? <Check className="h-4 w-4 text-success" aria-label="On" /> : <span className="text-muted-foreground">—</span>}{state?.trial && <span className="text-xs text-info">trial</span>}</span>; }
function Attention({ row }: { row: AdminOrganisationRow }) { const count = organisationNeedsAttention(row); if (!count) return <span className="text-muted-foreground">—</span>; const copy = `${count} client${count === 1 ? "" : "s"} need lodgement cycles`; return <Tooltip><TooltipTrigger asChild><span className="inline-flex items-center gap-1 text-info"><AlertCircle className="h-4 w-4" /><span className="tabular-nums">{count}</span></span></TooltipTrigger><TooltipContent>{copy}</TooltipContent></Tooltip>; }

function MemberOrganisations({ firms, loading }: { firms: { id: string; name: string }[]; loading: boolean }) { if (loading) return <CenteredLoader />; return <div className="overflow-hidden rounded-md border"><table className="w-full text-sm"><tbody>{firms.map((firm) => <tr key={firm.id} className="border-t first:border-t-0"><td className="px-4 py-3 font-medium"><Link to="/firms/$firmId/overview" params={{ firmId: firm.id }} className="block">{firm.name}</Link></td></tr>)}</tbody></table></div>; }
function CenteredLoader() { return <div className="grid min-h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>; }
function AccessDenied() { return <PageContainer width="readable"><div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4"><ShieldAlert className="h-5 w-5 text-destructive" /><div><p className="font-medium text-destructive">System Admin access required</p><p className="mt-1 text-sm text-muted-foreground">This area is for platform staff.</p></div></div></PageContainer>; }