import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteComingSoon, listComingSoonAdmin, saveComingSoon, type AdminComingSoonRow } from "@/lib/coming-soon.functions";
import { saveCardComingSoon } from "@/lib/card-model.functions";
import type { CardCatalogue } from "@/lib/cards/catalogue";

const KEY = ["coming-soon-admin"];
const NONE = "__none";

/**
 * System Administrator Roadmap editor (stored as coming_soon_entries).
 * Automatic entries come from Work-in-progress cards; editing one saves an
 * override entry linked to that card, so it still disappears automatically
 * once the card is Available. Every save is aal2 + audited in the database.
 * Showing an entry never makes its card visible or usable.
 */
type Item =
  | { kind: "manual"; row: AdminComingSoonRow }
  | { kind: "auto"; cardKey: string; label: string; description: string; hidden: boolean; override: AdminComingSoonRow | null };

const AUTO_SORT = 1000;

export function ComingSoonAdmin({ catalogue }: { catalogue: CardCatalogue }) {
  const list = useServerFn(listComingSoonAdmin);
  const save = useServerFn(saveComingSoon);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => list(), retry: false });
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState(false);
  const rows = q.data?.rows ?? [];
  const wip = catalogue.cards.filter((c) => c.status === "wip");
  const items: Item[] = [
    ...rows.filter((r) => !(r.cardKey && wip.some((c) => c.key === r.cardKey))).map((row) => ({ kind: "manual" as const, row })),
    ...wip.map((c) => ({
      kind: "auto" as const, cardKey: c.key, label: c.label, description: c.description, hidden: !!c.comingSoonHidden,
      override: rows.find((r) => r.cardKey === c.key) ?? null,
    })),
  ].sort((a, b) => sortOf(a) - sortOf(b) || nameOf(a).localeCompare(nameOf(b)));

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setMoving(true);
    try {
      // Renumber and save only entries whose position changed.
      for (let k = 0; k < next.length; k++) {
        const it = next[k]!;
        const so = (k + 1) * 10;
        if (sortOf(it) === so) continue;
        await save({ data: payload(it, { sortOrder: so }) });
      }
      await qc.invalidateQueries({ queryKey: KEY });
    } catch (e: any) {
      toast.error(e?.message ?? "The order could not be saved.");
    } finally {
      setMoving(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Roadmap</h2>
          <p className="text-sm text-muted-foreground">
            Shown to practice users under "More with Advisory" and on the Upgrade page; ticked entries also show on the website.
            Work-in-progress cards are listed automatically and can be edited here. Entries linked to a module or card disappear
            automatically once it is Available.
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
          {items.map((it, i) => (
            <EntryRow
              key={it.kind === "manual" ? it.row.key : `auto-${it.cardKey}`}
              catalogue={catalogue}
              item={it}
              onUp={i > 0 && !moving ? () => move(i, -1) : undefined}
              onDown={i < items.length - 1 && !moving ? () => move(i, 1) : undefined}
            />
          ))}
          {!adding && items.length === 0 && <p className="text-sm text-muted-foreground">No entries.</p>}
        </ul>
      )}
    </section>
  );
}

function sortOf(it: Item) {
  return it.kind === "manual" ? it.row.sortOrder : it.override?.sortOrder ?? AUTO_SORT;
}
function nameOf(it: Item) {
  return it.kind === "manual" ? it.row.name : it.override?.name ?? it.label;
}

type Fields = { name: string; description: string; timing: string; shown: boolean; showOnWebsite: boolean; link: string };

function fieldsOf(it?: Item): Fields {
  if (!it) return { name: "", description: "", timing: "", shown: true, showOnWebsite: false, link: NONE };
  if (it.kind === "manual") {
    const r = it.row;
    return { name: r.name, description: r.description, timing: r.timing ?? "", shown: r.shown, showOnWebsite: r.showOnWebsite, link: r.cardKey ? `card:${r.cardKey}` : r.moduleKey ? `module:${r.moduleKey}` : NONE };
  }
  const o = it.override;
  return { name: o?.name ?? it.label, description: o?.description ?? it.description, timing: o?.timing ?? "", shown: o ? o.shown : !it.hidden, showOnWebsite: o?.showOnWebsite ?? false, link: `card:${it.cardKey}` };
}

/** Save payload; automatic entries are saved as an override linked to their card. */
function payload(it: Item, over: Partial<Fields> & { sortOrder?: number } = {}) {
  const f = { ...fieldsOf(it), ...over };
  const key = it.kind === "manual" ? it.row.key : it.override?.key ?? `auto_${it.cardKey}`.slice(0, 40);
  return {
    key,
    name: f.name.trim() || nameOf(it),
    description: f.description,
    timing: f.timing.trim() ? f.timing : null,
    sortOrder: over.sortOrder ?? sortOf(it),
    shown: f.shown,
    showOnWebsite: f.showOnWebsite,
    moduleKey: f.link.startsWith("module:") ? f.link.slice(7) : null,
    cardKey: f.link.startsWith("card:") ? f.link.slice(5) : null,
  };
}

function EntryRow({ catalogue, item, isNew, onDone, onUp, onDown }: {
  catalogue: CardCatalogue; item?: Item; isNew?: boolean; onDone?: () => void; onUp?: () => void; onDown?: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveComingSoon);
  const remove = useServerFn(deleteComingSoon);
  const setHidden = useServerFn(saveCardComingSoon);
  const [f, setF] = useState<Fields>(() => fieldsOf(item));
  const dep = JSON.stringify(fieldsOf(item));
  useEffect(() => { if (item) setF(fieldsOf(item)); }, [dep]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Fields>) => setF((x) => ({ ...x, ...p }));
  const done = async () => {
    await qc.invalidateQueries({ queryKey: KEY });
    await qc.invalidateQueries({ queryKey: ["card-catalogue", "with-wip"] });
    onDone?.();
  };
  const auto = item?.kind === "auto" ? item : null;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isNew || !item) {
        const key = f.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "x$1").slice(0, 40);
        return save({ data: {
          key, name: f.name, description: f.description, timing: f.timing.trim() ? f.timing : null, sortOrder: 100,
          shown: f.shown, showOnWebsite: f.showOnWebsite,
          moduleKey: f.link.startsWith("module:") ? f.link.slice(7) : null,
          cardKey: f.link.startsWith("card:") ? f.link.slice(5) : null,
        } });
      }
      // An automatic entry that is shown again also clears the card's opt-out.
      if (auto && f.shown && auto.hidden) await setHidden({ data: { cardKey: auto.cardKey, hidden: false } });
      return save({ data: payload(item, f) });
    },
    onSuccess: async () => { toast.success("Roadmap entry saved"); await done(); },
    onError: (e: any) => toast.error(e?.message === "Forbidden" ? "Only System Administrators can change the Roadmap." : e?.message ?? "The entry could not be saved."),
  });
  const delMut = useMutation({
    mutationFn: async () => {
      if (item?.kind === "manual") return remove({ data: { key: item.row.key } });
      if (auto?.override) return remove({ data: { key: auto.override.key } });
    },
    onSuccess: async () => { toast.success(auto ? "Back to the automatic entry" : "Entry removed"); await done(); },
    onError: (e: any) => toast.error(e?.message ?? "The entry could not be removed."),
  });
  const hideMut = useMutation({
    mutationFn: async () => {
      if (!auto) return;
      await setHidden({ data: { cardKey: auto.cardKey, hidden: true } });
      if (auto.override) await save({ data: payload(auto, { shown: false }) });
    },
    onSuccess: async () => { toast.success("Hidden from the Roadmap"); await done(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not hide that entry."),
  });

  const nowAvailable = item?.kind === "manual" && item.row.nowAvailable;
  return (
    <li className="space-y-2 rounded-md border border-border bg-card p-3 text-sm">
      {auto && (
        <p className="text-xs text-muted-foreground">
          Automatic — from the Work-in-progress card "{auto.label}"{auto.override ? " (edited)" : ""}{!f.shown ? " · hidden" : ""}
        </p>
      )}
      {nowAvailable && <p className="text-xs font-medium text-link">Now available — hidden from the Roadmap. You can remove this entry.</p>}
      <div className="grid gap-2 md:grid-cols-[1fr_2fr_10rem]">
        <Input aria-label="Name" placeholder="Name" value={f.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
        <Input aria-label="Description" placeholder="One-line description" value={f.description} maxLength={200} onChange={(e) => set({ description: e.target.value })} />
        <Input aria-label="Expected" placeholder="Expected (e.g. Early 2027)" value={f.timing} maxLength={40} onChange={(e) => set({ timing: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {!auto && (
          <Select value={f.link} onValueChange={(v) => set({ link: v })}>
            <SelectTrigger className="h-8 w-64" aria-label="Linked module or card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Stand-alone roadmap item</SelectItem>
              {catalogue.modules.map((m) => <SelectItem key={m.key} value={`module:${m.key}`}>Module: {m.label}</SelectItem>)}
              {catalogue.cards.map((c) => <SelectItem key={c.key} value={`card:${c.key}`}>Card: {c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <label className="flex items-center gap-2"><Checkbox checked={f.shown} onCheckedChange={(v) => set({ shown: v === true })} />Show</label>
        <label className="flex items-center gap-2"><Checkbox checked={f.showOnWebsite} onCheckedChange={(v) => set({ showOnWebsite: v === true })} />Show on website</label>
        <div className="ml-auto flex flex-wrap gap-2">
          {!isNew && (
            <>
              <Button size="sm" variant="ghost" onClick={onUp} disabled={!onUp} aria-label={`Move ${f.name} up`}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={onDown} disabled={!onDown} aria-label={`Move ${f.name} down`}><ArrowDown className="h-3.5 w-3.5" /></Button>
            </>
          )}
          {isNew && <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>}
          {item?.kind === "manual" && (
            <Button size="sm" variant="ghost" onClick={() => delMut.mutate()} disabled={delMut.isPending} aria-label={`Remove ${f.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
          )}
          {auto?.override && (
            <Button size="sm" variant="ghost" onClick={() => delMut.mutate()} disabled={delMut.isPending}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset</Button>
          )}
          {auto && f.shown && (
            <Button size="sm" variant="outline" onClick={() => hideMut.mutate()} disabled={hideMut.isPending}>Hide</Button>
          )}
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={!f.name.trim() || saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Save
          </Button>
        </div>
      </div>
    </li>
  );
}
