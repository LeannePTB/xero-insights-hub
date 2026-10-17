import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteScenario, listSavedScenarios, saveScenario, setScenarioReport, setScenarioShared, type SavedScenario } from "@/lib/scenario/saved-scenarios.functions";
import { parsePayload, type ScenarioPayload } from "@/lib/scenario/adjustments";

/** Saved scenarios for one client. Editing controls show only to people who
 *  can manage the client; the database enforces the same rule on every write. */
export function SavedScenariosBar({ clientId, canManage, loaded, monthEnd, monthLabel, currentPayload, reportTable, onLoad }: {
  clientId: string;
  canManage: boolean;
  loaded: { id: string; name: string } | null;
  monthEnd: string;
  monthLabel: string;
  currentPayload: () => ScenarioPayload;
  reportTable: () => Record<string, unknown> | null;
  onLoad: (s: SavedScenario | null, p: ScenarioPayload | null) => void | Promise<void>;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listSavedScenarios);
  const save = useServerFn(saveScenario);
  const del = useServerFn(deleteScenario);
  const share = useServerFn(setScenarioShared);
  const toReport = useServerFn(setScenarioReport);
  const key = ["saved-scenarios", clientId];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { clientId } }) });
  const [name, setName] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const current = q.data?.find((s) => s.id === loaded?.id) ?? null;

  const saveMut = useMutation({
    mutationFn: (v: { id: string | null; name: string }) => save({ data: { clientId, id: v.id, name: v.name, payload: currentPayload() as any, reportTable: reportTable() } }),
    onSuccess: async (r, v) => { await refresh(); setName(""); toast.success("Scenario saved"); const s = { id: r.id, name: v.name } as SavedScenario; void onLoadQuiet(s); },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });
  const onLoadQuiet = (s: SavedScenario) => { (loadedRef.current = s); };
  const loadedRef = { current: null as SavedScenario | null };
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refresh(),
    onError: (e: any) => toast.error(e?.message ?? "Could not update the scenario"),
  });

  if (!canManage && !(q.data?.length)) return null;
  return (
    <section aria-label="Saved scenarios" className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Scenario</span>
        <Select value={loaded?.id ?? "__baseline"} onValueChange={(v) => {
          if (v === "__baseline") return void onLoad(null, null);
          const s = q.data?.find((x) => x.id === v); if (!s) return;
          const p = parsePayload(s.payload); if (!p) return void toast.error("This saved scenario could not be read.");
          void onLoad(s, p);
        }}>
          <SelectTrigger className="h-9 w-[260px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__baseline">Unsaved / baseline</SelectItem>
            {(q.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.shared_with_client ? " · shared" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
        {loaded && <span className="font-display text-base font-semibold">{loaded.name}</span>}
      </div>
      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input className="h-9 w-[260px]" placeholder={loaded ? "New name (rename or duplicate)" : "Scenario name, e.g. Hire 2nd mechanic"} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          {loaded && <Button size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate({ id: loaded.id, name: name.trim() || loaded.name })}>Save changes{name.trim() ? " & rename" : ""}</Button>}
          <Button size="sm" variant={loaded ? "outline" : "default"} disabled={saveMut.isPending || !(name.trim() || loaded)} onClick={() => saveMut.mutate({ id: null, name: name.trim() || `${loaded!.name} (copy)` })}>{loaded ? "Duplicate" : "Save scenario"}</Button>
          {current && <>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={current.shared_with_client} onCheckedChange={(on) => act.mutate(() => share({ data: { id: current.id, shared: !!on } }))} />Share with client</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={current.report_period_end === monthEnd} onCheckedChange={(on) => act.mutate(() => toReport({ data: { id: current.id, periodEnd: on ? monthEnd : null } }))} />Include in {monthLabel} report (new drafts)</label>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Delete "${current.name}"?`)) act.mutate(async () => { await del({ data: { id: current.id } }); await onLoad(null, null); }); }}>Delete</Button>
          </>}
        </div>
      )}
      {canManage && <p className="mt-2 text-xs text-muted-foreground">Shared scenarios can be opened read-only by this client's Business Owners. Viewers never see saved scenarios.</p>}
    </section>
  );
}
