import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAccountSetup, saveAccountSetup } from "@/lib/account-setup.functions";
import { VALUE_LABELS, progress, type SetupGroup, type SetupRow, type SetupValue } from "@/lib/account-setup";

const GROUPS: { group: SetupGroup; id: string; title: string; detail: string }[] = [
  { group: "bank", id: "account-setup-bank", title: "Bank & cash", detail: "Which Xero bank accounts count as cash, which are credit cards, and which to leave out of cash." },
  { group: "tax", id: "account-setup-tax", title: "Tax & super", detail: "Which liability accounts hold GST, PAYG withholding or super owed." },
  { group: "cost", id: "account-setup-cost", title: "Costs", detail: "Wages count as a fixed cost for break-even unless marked casual." },
];
type Filter = "needs" | "all" | "manual";

export function AccountSetupPanel({ clientId, tenantId, tenantName }: { clientId: string; tenantId: string; tenantName: string }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getAccountSetup);
  const saveFn = useServerFn(saveAccountSetup);
  const [filter, setFilter] = useState<Filter>("all");
  const key = ["account-setup", clientId, tenantId];
  const q = useQuery({ queryKey: key, queryFn: () => fetchFn({ data: { clientId, tenantId } }) });
  const save = useMutation({
    mutationFn: (changes: any[]) => saveFn({ data: { clientId, tenantId, changes } }),
    onSuccess: () => {
      toast.success("Saved");
      for (const k of [key, ["client-setup", clientId], ["cost-classifications", clientId], ["clients"]]) qc.invalidateQueries({ queryKey: k });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const rows = q.data?.rows ?? [];
  const p = useMemo(() => progress(rows), [rows]);
  if (q.isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading {tenantName}'s chart of accounts…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as any)?.message ?? "Account setup could not be read."}</p>;

  const pending = (list: SetupRow[]) => list.filter((r) => r.stored === null && !r.unmatched);
  const acceptAll = (list: SetupRow[]) => {
    const changes = pending(list).map((r) => ({ accountId: r.accountId!, group: r.group, value: r.suggestion, wagesVariable: false }));
    if (changes.length) save.mutate(changes);
  };
  const shown = (r: SetupRow) => filter === "all" || (filter === "needs" ? r.stored === null || r.unmatched : r.stored !== null && r.stored !== r.suggestion);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{tenantName}</h3>
          <p className="text-xs text-muted-foreground">{p.done} of {p.total} done</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border bg-card p-0.5 text-xs" role="group" aria-label="Filter accounts">
            {([["needs", "Needs a decision"], ["all", "All"], ["manual", "Changed by hand"]] as const).map(([f, label]) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded px-2 py-1 ${filter === f ? "bg-muted text-foreground" : "text-muted-foreground"}`}>{label}</button>
            ))}
          </div>
          <Button size="sm" variant="outline" disabled={save.isPending || pending(rows).length === 0} onClick={() => acceptAll(rows)}>Accept all suggestions</Button>
        </div>
      </div>

      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.group === g.group);
        const recent = list.filter((r) => r.active).filter(shown);
        const quiet = list.filter((r) => !r.active).filter(shown);
        return (
          <section key={g.group} id={g.id} className="scroll-mt-6 space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">{g.title}</h4>
                <p className="text-xs text-muted-foreground">{g.detail}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={save.isPending || pending(list).length === 0} onClick={() => acceptAll(list)}>
                Accept {pending(list).length} suggestion{pending(list).length === 1 ? "" : "s"}
              </Button>
            </div>
            <RowList rows={recent} busy={save.isPending} onSave={(c) => save.mutate([c])} />
            {g.group === "tax" ? <AddTaxAccount chart={q.data?.chart ?? []} taken={new Set(list.map((r) => r.accountId ?? ""))} busy={save.isPending} onAdd={(id) => save.mutate([{ accountId: id, group: "tax", value: "none" }])} /> : null}
            {quiet.length > 0 ? (
              <Collapsible>
                <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  No recent activity ({quiet.length}) <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2"><RowList rows={quiet} busy={save.isPending} onSave={(c) => save.mutate([c])} /></CollapsibleContent>
              </Collapsible>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function RowList({ rows, busy, onSave }: { rows: SetupRow[]; busy: boolean; onSave: (c: any) => void }) {
  if (rows.length === 0) return <p className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">Nothing to show here.</p>;
  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
      {rows.map((r) => {
        const value = (r.stored ?? r.suggestion) as SetupValue;
        return (
          <li key={r.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between" data-unclassified-account={r.stored === null ? "true" : undefined}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">{r.code ? <span className="text-muted-foreground">{r.code} · </span> : null}{r.name}</span>
                {r.unmatched ? <span className="rounded-md border border-destructive/30 px-1.5 py-0.5 text-xs text-destructive">Account not found in Xero</span>
                  : r.stored === null ? <span className="rounded-md border border-info/30 bg-info/10 px-1.5 py-0.5 text-xs text-info">Suggested</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {r.group === "cost" && value === "wages" && r.stored === "wages" ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={r.storedWagesVariable} disabled={busy} aria-label={`Casual / varies with sales for ${r.name}`}
                    onCheckedChange={(v) => onSave({ accountId: r.accountId, group: r.group, value: "wages", wagesVariable: v })} />
                  Casual / varies with sales
                </label>
              ) : null}
              {r.unmatched ? (
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => onSave({ rowId: r.rowId })}>Remove</Button>
              ) : (
                <Select value={value} disabled={busy} onValueChange={(v) => onSave({ accountId: r.accountId, group: r.group, value: v, wagesVariable: v === "wages" ? r.storedWagesVariable : false })}>
                  <SelectTrigger className="h-8 w-full bg-card text-xs sm:w-56" aria-label={`Choice for ${r.name}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{VALUE_LABELS[r.group].map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {r.stored === null && !r.unmatched ? (
                <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={busy} onClick={() => onSave({ accountId: r.accountId, group: r.group, value: r.suggestion, wagesVariable: false })}>Accept</Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AddTaxAccount({ chart, taken, busy, onAdd }: { chart: { id: string; name: string; code: string | null }[]; taken: Set<string>; busy: boolean; onAdd: (id: string) => void }) {
  const options = chart.filter((a) => !taken.has(a.id));
  if (options.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
      <Select value="" disabled={busy} onValueChange={onAdd}>
        <SelectTrigger className="h-8 w-full bg-card text-xs sm:w-80" aria-label="Add another account as a tax account"><SelectValue placeholder="Add another account as a tax account" /></SelectTrigger>
        <SelectContent>{options.map((a) => <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ""}{a.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
