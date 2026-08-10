import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/roles.functions";
import { savePlanLevel, deletePlanLevel, type PlanLevel, type PlanScope } from "@/lib/plan-levels.functions";
import { usePlanLevels } from "@/hooks/usePlanLevels";
import { ALL_WIDGETS, WIDGET_LABEL, type WidgetKey } from "@/lib/tiers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Layers, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  head: () => ({
    meta: [
      { title: "Subscription levels — Traction Advisory" },
      { name: "description", content: "Create and edit organisation plans and client dashboard tiers." },
    ],
  }),
  component: PlanLevelsPage,
});

const EMPTY = (scope: PlanScope): Draft => ({
  id: null,
  scope,
  key: "",
  label: "",
  description: "",
  client_limit: scope === "firm" ? 5 : 0,
  xero_org_limit: 1,
  allows_multi_org: false,
  widgets: [],
  allowed_tiers: [],
  sort_order: 100,
  enabled: true,
});

type Draft = {
  id: string | null;
  scope: PlanScope;
  key: string;
  label: string;
  description: string;
  client_limit: number;
  xero_org_limit: number;
  allows_multi_org: boolean;
  widgets: string[];
  allowed_tiers: string[];
  sort_order: number;
  enabled: boolean;
};

/** Pre-filled copy of a level — new key/label, no id, so saving creates a new row. */
function duplicateOf(l: PlanLevel): Draft {
  return {
    id: null,
    scope: l.scope,
    key: `${l.key}_copy`,
    label: `${l.label} (copy)`,
    description: l.description ?? "",
    client_limit: l.client_limit,
    xero_org_limit: l.xero_org_limit,
    allows_multi_org: l.allows_multi_org,
    widgets: [...(l.widgets ?? [])],
    allowed_tiers: [...(l.allowed_tiers ?? [])],
    sort_order: (l.sort_order ?? 100) + 1,
    enabled: l.enabled,
  };
}


function PlanLevelsPage() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getMyContext);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const levelsQ = usePlanLevels();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlanLevel | null>(null);

  const saveFn = useServerFn(savePlanLevel);
  const delFn = useServerFn(deletePlanLevel);

  const saveMut = useMutation({
    mutationFn: (d: Draft) => saveFn({ data: { ...d, id: d.id ?? undefined } }),
    onSuccess: () => {
      toast.success("Level saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["plan-levels"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save level"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Level removed");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["plan-levels"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove level"),
  });

  const firmLevels = useMemo(() => levelsQ.all.filter((l) => l.scope === "firm"), [levelsQ.all]);
  const dashLevels = useMemo(() => levelsQ.all.filter((l) => l.scope === "dashboard"), [levelsQ.all]);

  if (ctxQ.isLoading || levelsQ.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!ctxQ.data?.isSuperAdmin) {
    return <p className="p-6 text-sm text-destructive">Super admins only.</p>;
  }

  return (
    <>
      <main className="w-full px-6 py-8 space-y-8">
        <header>
          <h1 className="font-display text-3xl font-semibold">Subscription levels</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, rename or retire the plans organisations subscribe to, and the dashboard tiers you grant each client.
          </p>
        </header>

        <LevelSection
          title="Organisation plans"
          hint="What an accounting firm subscribes to. The client limit is the default quota; you can override it per organisation."
          scope="firm"
          levels={firmLevels}
          tierLevels={dashLevels}
          onNew={() => setDraft(EMPTY("firm"))}
          onEdit={(l) => setDraft({ ...l, id: l.id })}
          onDuplicate={(l) => setDraft(duplicateOf(l))}
          onDelete={setPendingDelete}
        />

        <LevelSection
          title="Client dashboard tiers"
          hint="What each client sees. Pick the widgets and how many Xero files the tier may link."
          scope="dashboard"
          levels={dashLevels}
          onNew={() => setDraft(EMPTY("dashboard"))}
          onEdit={(l) => setDraft({ ...l, id: l.id })}
          onDuplicate={(l) => setDraft(duplicateOf(l))}
          onDelete={setPendingDelete}
        />
      </main>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit level" : "New level"}</DialogTitle>
            <DialogDescription>
              {draft?.scope === "firm" ? "Organisation subscription plan." : "Client dashboard tier."}
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="Growth"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Key</Label>
                  <Input
                    value={draft.key}
                    disabled={!!draft.id}
                    onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                    placeholder="growth"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {draft.id ? "Keys can't change once in use." : "Lowercase, no spaces. Stored on subscriptions."}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {draft.scope === "firm" && (
                  <div className="space-y-1.5">
                    <Label>Client limit</Label>
                    <Input
                      type="number"
                      min={0}
                      value={draft.client_limit}
                      onChange={(e) => setDraft({ ...draft, client_limit: Number(e.target.value) })}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Xero files allowed</Label>
                  <Input
                    type="number"
                    min={1}
                    value={draft.xero_org_limit}
                    onChange={(e) => setDraft({ ...draft, xero_org_limit: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Available</p>
                  <p className="text-xs text-muted-foreground">Hidden from the dropdowns when off.</p>
                </div>
                <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
              </div>

              {draft.scope === "firm" && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Included dashboard tiers
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Which client dashboards an organisation on this plan can hand out. Leave all unticked to allow every tier.
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {dashLevels.map((t) => (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={draft.allowed_tiers.includes(t.key)}
                          onCheckedChange={() =>
                            setDraft({
                              ...draft,
                              allowed_tiers: draft.allowed_tiers.includes(t.key)
                                ? draft.allowed_tiers.filter((x) => x !== t.key)
                                : [...draft.allowed_tiers, t.key],
                            })
                          }
                        />
                        <span>{t.label}</span>
                      </label>
                    ))}
                    {dashLevels.length === 0 && (
                      <p className="text-xs text-muted-foreground">Create dashboard tiers below first.</p>
                    )}
                  </div>
                </div>
              )}

              {draft.scope === "dashboard" && (
                <>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">Multiple Xero files</p>
                      <p className="text-xs text-muted-foreground">Allow a client on this tier to link more than one file.</p>
                    </div>
                    <Switch
                      checked={draft.allows_multi_org}
                      onCheckedChange={(v) => setDraft({ ...draft, allows_multi_org: v })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Widgets</Label>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {ALL_WIDGETS.map((w) => (
                        <label
                          key={w}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={draft.widgets.includes(w)}
                            onCheckedChange={() =>
                              setDraft({
                                ...draft,
                                widgets: draft.widgets.includes(w)
                                  ? draft.widgets.filter((x) => x !== w)
                                  : [...draft.widgets, w],
                              })
                            }
                          />
                          <span>{WIDGET_LABEL[w as WidgetKey]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button
              onClick={() => draft && saveMut.mutate(draft)}
              disabled={saveMut.isPending || !draft?.label.trim() || !draft?.key.trim()}
            >
              {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save level
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove level</DialogTitle>
            <DialogDescription>
              Remove “{pendingDelete?.label}”? Anyone already on it must be moved to another level first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => pendingDelete && delMut.mutate(pendingDelete.id)}
            >
              {delMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LevelSection({
  title,
  hint,
  scope,
  levels,
  tierLevels,
  onNew,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  title: string;
  hint: string;
  scope: PlanScope;
  levels: PlanLevel[];
  tierLevels?: PlanLevel[];
  onNew: () => void;
  onEdit: (l: PlanLevel) => void;
  onDuplicate: (l: PlanLevel) => void;
  onDelete: (l: PlanLevel) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">{title}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onNew}>
          <Plus className="mr-2 h-4 w-4" /> New level
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              {scope === "firm" && <th className="px-4 py-2">Clients</th>}
              {scope === "firm" && <th className="px-4 py-2">Dashboard tiers</th>}
              <th className="px-4 py-2">Xero files</th>
              {scope === "dashboard" && <th className="px-4 py-2">Widgets</th>}
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {levels.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No levels yet.</td>
              </tr>
            )}
            {levels.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{l.label}</span>
                    {!l.enabled && <Badge variant="outline">off</Badge>}
                    {l.allows_multi_org && <Badge variant="secondary">multi-file</Badge>}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">{l.key}</div>
                </td>
                {scope === "firm" && (
                  <td className="px-4 py-3 tabular-nums">{l.client_limit >= 9999 ? "Unlimited" : l.client_limit}</td>
                )}
                {scope === "firm" && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(l.allowed_tiers ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">All tiers</span>
                      ) : (
                        (l.allowed_tiers ?? []).map((k) => (
                          <Badge key={k} variant="secondary">
                            {tierLevels?.find((t) => t.key === k)?.label ?? k}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 tabular-nums">{l.xero_org_limit}</td>
                {scope === "dashboard" && (
                  <td className="px-4 py-3 text-muted-foreground">{l.widgets.length} selected</td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEdit(l)}>
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onDuplicate(l)}>
                      <Copy className="mr-1 h-3 w-3" /> Duplicate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(l)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
