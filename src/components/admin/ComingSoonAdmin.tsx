import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteComingSoon, listComingSoonAdmin, saveComingSoon, type AdminComingSoonRow } from "@/lib/coming-soon.functions";
import type { CardCatalogue } from "@/lib/cards/catalogue";

const KEY = ["coming-soon-admin"];

/**
 * System Administrator editor for Coming soon teasers. Writes go through
 * admin_save_coming_soon / admin_delete_coming_soon (aal2, audited). Showing an
 * entry never makes its card visible or usable.
 */
export function ComingSoonAdmin({ catalogue }: { catalogue: CardCatalogue }) {
  const list = useServerFn(listComingSoonAdmin);
  const q = useQuery({ queryKey: KEY, queryFn: () => list(), retry: false });
  const [adding, setAdding] = useState(false);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Coming soon</h2>
          <p className="text-sm text-muted-foreground">
            Teasers shown to practice users under "More with Advisory" and on the Upgrade page. An entry linked to a module or card
            is hidden automatically once that module or card is Available.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}><Plus className="mr-1 h-3.5 w-3.5" />Add entry</Button>
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (
        <ul className="space-y-2">
          {adding && <EntryRow catalogue={catalogue} isNew onDone={() => setAdding(false)} />}
          {(q.data?.rows ?? []).map((r) => <EntryRow key={r.key} catalogue={catalogue} row={r} />)}
          {!adding && (q.data?.rows ?? []).length === 0 && <p className="text-sm text-muted-foreground">No entries.</p>}
        </ul>
      )}
    </section>
  );
}

const NONE = "__none";

function EntryRow({ catalogue, row, isNew, onDone }: { catalogue: CardCatalogue; row?: AdminComingSoonRow; isNew?: boolean; onDone?: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveComingSoon);
  const remove = useServerFn(deleteComingSoon);
  const init = () => ({
    key: row?.key ?? "",
    name: row?.name ?? "",
    description: row?.description ?? "",
    timing: row?.timing ?? "",
    sortOrder: String(row?.sortOrder ?? 100),
    shown: row?.shown ?? true,
    showOnWebsite: row?.showOnWebsite ?? false,
    link: row?.cardKey ? `card:${row.cardKey}` : row?.moduleKey ? `module:${row.moduleKey}` : NONE,
  });
  const [f, setF] = useState(init);
  useEffect(() => { if (row) setF(init()); }, [row]);
  const set = (p: Partial<ReturnType<typeof init>>) => setF((x) => ({ ...x, ...p }));
  const done = () => { qc.invalidateQueries({ queryKey: KEY }); onDone?.(); };
  const saveMut = useMutation({
    mutationFn: () => {
      const key = isNew ? f.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "x$1").slice(0, 40) : f.key;
      return save({
        data: {
          key,
          name: f.name,
          description: f.description,
          timing: f.timing.trim() ? f.timing : null,
          sortOrder: Math.max(0, Math.min(9999, Number(f.sortOrder) || 0)),
          shown: f.shown,
          showOnWebsite: f.showOnWebsite,
          moduleKey: f.link.startsWith("module:") ? f.link.slice(7) : null,
          cardKey: f.link.startsWith("card:") ? f.link.slice(5) : null,
        },
      });
    },
    onSuccess: () => { toast.success("Coming soon entry saved"); done(); },
    onError: (e: any) => toast.error(e?.message ?? "The entry could not be saved."),
  });
  const delMut = useMutation({
    mutationFn: () => remove({ data: { key: f.key } }),
    onSuccess: () => { toast.success("Entry removed"); done(); },
    onError: (e: any) => toast.error(e?.message ?? "The entry could not be removed."),
  });
  return (
    <li className="space-y-2 rounded-md border p-3 text-sm">
      {row?.nowAvailable && (
        <p className="text-xs font-medium text-link">Now available — hidden from Coming soon. You can remove this entry.</p>
      )}
      <div className="grid gap-2 md:grid-cols-[1fr_2fr_10rem_6rem]">
        <Input aria-label="Module name" placeholder="Module name" value={f.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
        <Input aria-label="One-line description" placeholder="One-line description" value={f.description} maxLength={200} onChange={(e) => set({ description: e.target.value })} />
        <Input aria-label="Timing" placeholder="Timing (optional)" value={f.timing} maxLength={40} onChange={(e) => set({ timing: e.target.value })} />
        <Input aria-label="Sort order" type="number" value={f.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Select value={f.link} onValueChange={(v) => set({ link: v })}>
          <SelectTrigger className="h-8 w-64" aria-label="Linked module or card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Stand-alone roadmap item</SelectItem>
            {catalogue.modules.map((m) => <SelectItem key={m.key} value={`module:${m.key}`}>Module: {m.label}</SelectItem>)}
            {catalogue.cards.map((c) => <SelectItem key={c.key} value={`card:${c.key}`}>Card: {c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2"><Checkbox checked={f.shown} onCheckedChange={(v) => set({ shown: v === true })} />Show</label>
        <label className="flex items-center gap-2"><Checkbox checked={f.showOnWebsite} onCheckedChange={(v) => set({ showOnWebsite: v === true })} />Show on website</label>
        <div className="ml-auto flex gap-2">
          {isNew && <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>}
          {!isNew && (
            <Button size="sm" variant="ghost" onClick={() => delMut.mutate()} disabled={delMut.isPending} aria-label={`Remove ${f.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
          )}
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={!f.name.trim() || saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Save
          </Button>
        </div>
      </div>
    </li>
  );
}
