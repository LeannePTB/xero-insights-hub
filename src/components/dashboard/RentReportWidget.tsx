import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Home, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  deleteRentalProperty,
  getRentConsolidation,
  getRentPickers,
  getRentReport,
  saveRentalProperty,
  type RentPropertyRow,
} from "@/lib/rent.functions";
import type { RentFrequency, RentMatchType, RentPosition } from "@/lib/rent";
import { formatMoneyExact, useTenantCurrency } from "./useTenantCurrency";

const FREQ_LABEL: Record<RentFrequency, string> = { weekly: "week", fortnightly: "fortnight", monthly: "month" };
const MATCH_LABEL: Record<RentMatchType, string> = {
  account: "Account",
  tracking: "Tracking category option",
  contact: "Tenant or agent (contact)",
};

function d(date: string | null) {
  return date ? format(new Date(`${date}T00:00:00`), "d MMM yyyy") : "—";
}

function StatusChip({ p, money }: { p: RentPosition | null; money: (n: number) => string }) {
  if (!p) return <span className="text-muted-foreground">Not available yet</span>;
  if (p.status === "no_rent") return <span className="text-muted-foreground">No rent found</span>;
  if (p.status === "ahead") return <span className="font-medium text-success">Paid ahead</span>;
  if (p.status === "due") return <span className="font-medium text-info">Due</span>;
  return (
    <span className="font-medium text-destructive">
      In arrears {money(p.arrearsAmount)} · {p.daysBehind} days
    </span>
  );
}

function RentTable({ rows, money, showClient, canEdit, onEdit, onDelete }: {
  rows: (RentPropertyRow & { clientName?: string })[];
  money: (n: number) => string;
  showClient?: boolean;
  canEdit?: boolean;
  onEdit?: (r: RentPropertyRow) => void;
  onDelete?: (r: RentPropertyRow) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            {showClient && <th className="py-2 pr-3">Company</th>}
            <th className="py-2 pr-3">Property</th>
            <th className="py-2 pr-3">Last paid</th>
            <th className="py-2 pr-3">Paid up to</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3 text-right">This month</th>
            <th className="py-2 pr-3 text-right">12 months</th>
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              {showClient && <td className="py-2 pr-3">{r.clientName}</td>}
              <td className="py-2 pr-3">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{money(r.expectedAmount)} per {FREQ_LABEL[r.frequency]}</div>
              </td>
              <td className="py-2 pr-3">
                {d(r.position?.lastPaidDate ?? null)}
                {r.position?.lastPaidAmount != null && (
                  <div className="text-xs text-muted-foreground">{money(r.position.lastPaidAmount)}</div>
                )}
              </td>
              <td className="py-2 pr-3">{d(r.position?.paidUpTo ?? null)}</td>
              <td className="py-2 pr-3"><StatusChip p={r.position} money={money} /></td>
              <td className="py-2 pr-3 text-right">{r.position ? money(r.position.receivedThisMonth) : "—"}</td>
              <td className="py-2 pr-3 text-right">{r.position ? money(r.position.received12Months) : "—"}</td>
              {canEdit && (
                <td className="py-2 text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" aria-label="Edit property" onClick={() => onEdit?.(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Remove property" onClick={() => onDelete?.(r)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Draft = {
  id: string | null;
  name: string;
  matchType: RentMatchType;
  matchIds: string[];
  expectedAmount: string;
  frequency: RentFrequency;
  leaseStart: string;
};

const emptyDraft: Draft = { id: null, name: "", matchType: "account", matchIds: [], expectedAmount: "", frequency: "weekly", leaseStart: "" };

function PropertyDialog({ open, onOpenChange, clientId, tenantId, initial, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  tenantId: string;
  initial: Draft;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [filter, setFilter] = useState("");
  const fetchPickers = useServerFn(getRentPickers);
  const save = useServerFn(saveRentalProperty);
  const pickers = useQuery({
    queryKey: ["rent-pickers", clientId, tenantId],
    queryFn: () => fetchPickers({ data: { clientId, tenantId } }),
    enabled: open,
    retry: false,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const options = useMemo(() => {
    const p = pickers.data;
    if (!p) return [];
    const list = draft.matchType === "account" ? p.accounts : draft.matchType === "tracking" ? p.tracking : p.contacts;
    const f = filter.trim().toLowerCase();
    return f ? list.filter((o) => o.label.toLowerCase().includes(f) || draft.matchIds.includes(o.id)) : list;
  }, [pickers.data, draft.matchType, draft.matchIds, filter]);

  const mutation = useMutation({
    mutationFn: () => save({
      data: {
        id: draft.id,
        clientId,
        tenantId,
        name: draft.name,
        matchType: draft.matchType,
        matchIds: draft.matchIds,
        expectedAmount: Number(draft.expectedAmount),
        frequency: draft.frequency,
        leaseStart: draft.leaseStart || null,
      },
    }),
    onSuccess: () => {
      toast.success("Rental property saved. Rent figures update after the next overnight refresh.");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const amount = Number(draft.expectedAmount);
  const valid = draft.name.trim() && draft.matchIds.length > 0 && amount > 0 && draft.matchIds.length <= 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{draft.id ? "Edit rental property" : "Add rental property"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="rent-name">Property name</Label>
            <Input id="rent-name" value={draft.name} maxLength={120} placeholder="12 Smith St" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <Label>Find this property's rent in Xero by</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {(Object.keys(MATCH_LABEL) as RentMatchType[]).map((t) => (
                <Button key={t} type="button" size="sm" variant={draft.matchType === t ? "default" : "outline"}
                  onClick={() => setDraft({ ...draft, matchType: t, matchIds: [] })}>{MATCH_LABEL[t]}</Button>
              ))}
            </div>
          </div>
          <div>
            <Input placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {pickers.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading from Xero…</p>}
              {pickers.error && <p className="text-sm text-destructive">{(pickers.error as Error).message}</p>}
              {pickers.data && options.length === 0 && <p className="text-sm text-muted-foreground">Nothing found in this Xero file.</p>}
              {options.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.matchIds.includes(o.id)}
                    onCheckedChange={(v) => setDraft({
                      ...draft,
                      matchIds: v ? [...draft.matchIds, o.id] : draft.matchIds.filter((x) => x !== o.id),
                    })}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rent-amount">Expected rent</Label>
              <Input id="rent-amount" type="number" min="0" step="0.01" value={draft.expectedAmount} onChange={(e) => setDraft({ ...draft, expectedAmount: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="rent-freq">Per</Label>
              <select id="rent-freq" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value as RentFrequency })}>
                <option value="weekly">Week</option>
                <option value="fortnightly">Fortnight</option>
                <option value="monthly">Month</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="rent-start">Lease start (optional)</Label>
            <Input id="rent-start" type="date" value={draft.leaseStart} onChange={(e) => setDraft({ ...draft, leaseStart: e.target.value })} />
            <p className="mt-1 text-xs text-muted-foreground">Paid up to is counted from this date, or from the first rent found in the last 13 months.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RentReportWidget({ clientId, tenantId, tenantName }: { clientId: string; tenantId: string; tenantName: string }) {
  const queryClient = useQueryClient();
  const fetchReport = useServerFn(getRentReport);
  const fetchGroup = useServerFn(getRentConsolidation);
  const remove = useServerFn(deleteRentalProperty);
  const currency = useTenantCurrency(tenantId);
  const money = (n: number) => formatMoneyExact(n, currency);
  const [dialog, setDialog] = useState<Draft | null>(null);
  const [groupView, setGroupView] = useState(false);
  const key = ["rent-report", clientId, tenantId];
  const report = useQuery({
    queryKey: key,
    queryFn: () => fetchReport({ data: { clientId, tenantId } }),
    retry: false,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const groupId = report.data?.groupId ?? null;
  const group = useQuery({
    queryKey: ["rent-consolidation", groupId],
    queryFn: () => fetchGroup({ data: { groupId: groupId! } }),
    enabled: groupView && !!groupId,
    retry: false,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const delMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Rental property removed."); queryClient.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = report.data;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{groupView ? group.data?.groupName ?? "Group" : tenantName}</p>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Home className="h-4 w-4 text-emphasis" /> {groupView ? "Rental consolidation" : "Rent report"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Rent received per property from Xero. Updated overnight.</p>
        </div>
        <div className="flex gap-2">
          {groupId && (
            <Button size="sm" variant="outline" onClick={() => setGroupView(!groupView)}>
              {groupView ? "This company" : "All companies in group"}
            </Button>
          )}
          {data?.canEdit && !groupView && (
            <Button size="sm" onClick={() => setDialog(emptyDraft)}><Plus className="mr-1 h-4 w-4" /> Add property</Button>
          )}
        </div>
      </div>

      {report.isLoading && <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}
      {report.error && <p className="mt-4 text-sm text-destructive">{(report.error as Error).message}</p>}

      {!groupView && data && (
        data.properties.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No rental properties set up yet.{data.canEdit ? " Add one to start tracking rent." : ""}
          </p>
        ) : (
          <>
            {!data.available && <p className="mt-4 text-sm text-muted-foreground">Rent figures appear after the next overnight refresh.</p>}
            <RentTable
              rows={data.properties}
              money={money}
              canEdit={data.canEdit}
              onEdit={(r) => setDialog({
                id: r.id, name: r.name, matchType: r.matchType, matchIds: r.matchIds,
                expectedAmount: String(r.expectedAmount), frequency: r.frequency, leaseStart: r.leaseStart ?? "",
              })}
              onDelete={(r) => { if (confirm(`Remove ${r.name}?`)) delMutation.mutate(r.id); }}
            />
          </>
        )
      )}

      {groupView && (
        group.isLoading ? <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        : group.error ? <p className="mt-4 text-sm text-destructive">{(group.error as Error).message}</p>
        : group.data && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Properties" value={String(group.data.totals.properties)} />
              <Stat label="In arrears" value={String(group.data.totals.behind)} tone={group.data.totals.behind > 0 ? "bad" : "good"} />
              <Stat label="Owing" value={money(group.data.totals.arrears)} tone={group.data.totals.arrears > 0 ? "bad" : "good"} />
              <Stat label="Received, 12 months" value={money(group.data.totals.received12Months)} />
            </div>
            {group.data.rows.length === 0
              ? <p className="mt-4 text-sm text-muted-foreground">No rental properties set up in this group yet.</p>
              : <RentTable rows={group.data.rows} money={money} showClient />}
          </>
        )
      )}

      {dialog && (
        <PropertyDialog
          key={dialog.id ?? "new"}
          open
          onOpenChange={(v) => { if (!v) setDialog(null); }}
          clientId={clientId}
          tenantId={tenantId}
          initial={dialog}
          onSaved={() => queryClient.invalidateQueries({ queryKey: key })}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const cls = tone === "bad" ? "text-destructive" : tone === "good" ? "text-success" : "";
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
