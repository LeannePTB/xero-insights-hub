import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/roles.functions";
import { listTierConfig, saveTierWidgets, listTierSettings, setTierEnabled } from "@/lib/tier-config.functions";
import { savePlanLevel, deletePlanLevel, type PlanLevel } from "@/lib/plan-levels.functions";
import { usePlanLevels } from "@/hooks/usePlanLevels";
import { ALL_TIERS, ALL_WIDGETS, TIER_LABEL, TIER_DESCRIPTION, WIDGET_LABEL, tierLabel, tierDescription, type DashboardTier, type WidgetKey } from "@/lib/tiers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { SuperAdminBadge } from "@/components/admin/SuperAdminOnly";

export const Route = createFileRoute("/_authenticated/settings/tiers")({
  head: () => ({
    meta: [
      { title: "Tier widgets — Traction Advisory" },
      { name: "description", content: "Add, remove and configure the dashboard tiers your clients can be given." },
    ],
  }),
  component: TierSettings,
});

function TierSettings() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getMyContext);
  const fetchCfg = useServerFn(listTierConfig);
  const fetchSettings = useServerFn(listTierSettings);
  const saveFn = useServerFn(saveTierWidgets);
  const toggleFn = useServerFn(setTierEnabled);
  const savePlanFn = useServerFn(savePlanLevel);
  const deletePlanFn = useServerFn(deletePlanLevel);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const cfgQ = useQuery({
    queryKey: ["tier-config", null],
    queryFn: () => fetchCfg({ data: { clientId: null } }),
  });
  const settingsQ = useQuery({ queryKey: ["tier-settings"], queryFn: () => fetchSettings() });
  const levelsQ = usePlanLevels("dashboard");

  const isAdvisor = ctxQ.data?.isAdvisor ?? false;
  const isSuperAdmin = ctxQ.data?.isSuperAdmin ?? false;

  type TierDraft = {
    id?: string;
    key: string;
    label: string;
    description: string;
    xero_org_limit: number;
    allows_multi_org: boolean;
    sort_order: number;
    widgets: string[];
  };
  const [draft, setDraft] = useState<TierDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlanLevel | null>(null);

  // Tier list comes from the catalogue; built-ins remain if the catalogue is empty.
  const tiers = useMemo(() => {
    const cat = levelsQ.levels;
    if (cat.length) return cat.map((l) => l.key);
    return [...ALL_TIERS] as string[];
  }, [levelsQ.levels]);
  const levelByKey = useMemo(
    () => new Map(levelsQ.levels.map((l) => [l.key, l])),
    [levelsQ.levels],
  );

  const saveMut = useMutation({
    mutationFn: ({ tier, widgets }: { tier: string; widgets: WidgetKey[] }) =>
      saveFn({ data: { clientId: null, tier: tier as DashboardTier, widgets } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["tier-config"] });
      qc.invalidateQueries({ queryKey: ["effective-widgets"] });
      qc.invalidateQueries({ queryKey: ["client-widgets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { tier: string; enabled: boolean }) =>
      toggleFn({ data: { tier: v.tier as DashboardTier, enabled: v.enabled } }),
    onSuccess: (_d, v) => {
      toast.success(v.enabled ? "Tier enabled" : "Tier disabled");
      qc.invalidateQueries({ queryKey: ["tier-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMut = useMutation({
    mutationFn: (d: TierDraft) =>
      savePlanFn({
        data: {
          id: d.id ?? null,
          scope: "dashboard",
          key: (d.key || d.label).trim(),
          label: d.label,
          description: d.description,
          xero_org_limit: d.allows_multi_org ? Math.max(2, d.xero_org_limit) : 1,
          allows_multi_org: d.allows_multi_org,
          widgets: d.widgets,
          sort_order: d.sort_order,
          enabled: true,
        },
      }),
    onSuccess: (_r, d) => {
      toast.success(d.id ? "Tier saved" : "Tier added");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["plan-levels"] });
      qc.invalidateQueries({ queryKey: ["tier-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save tier"),
  });


  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePlanFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Tier removed");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["plan-levels"] });
      qc.invalidateQueries({ queryKey: ["tier-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove tier"),
  });

  if (ctxQ.isLoading || cfgQ.isLoading || levelsQ.isLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!isAdvisor) return <p className="p-6 text-sm text-destructive">Advisors only.</p>;

  return (
    <AdminShell>
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> All clients</Link>
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-semibold">Dashboard tier widgets</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Turn each tier on or off and pick the widgets it shows. Disabled tiers won't appear when inviting viewers or assigning access.
              </p>
            </div>
            {isSuperAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft({
                    key: "",
                    label: "",
                    description: "",
                    xero_org_limit: 1,
                    allows_multi_org: false,
                    sort_order: 100 + levelsQ.levels.length,
                    widgets: [],
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> New tier
              </Button>
            )}
          </div>

          {tiers.map((tier) => {
            const enabled = (settingsQ.data?.enabled as Record<string, boolean> | undefined)?.[tier] ?? true;
            const level = levelByKey.get(tier);
            return (
              <TierEditor
                key={tier}
                tier={tier as DashboardTier}
                title={tierLabel(tier, level?.label)}
                description={tierDescription(tier, level?.description)}
                initial={((cfgQ.data?.global as Record<string, WidgetKey[]>)?.[tier]) ?? []}
                saving={saveMut.isPending}
                onSave={(widgets) => saveMut.mutate({ tier, widgets })}
                enabled={enabled}
                onToggleEnabled={(v) => toggleMut.mutate({ tier, enabled: v })}
                toggleDisabled={toggleMut.isPending}
                onDelete={isSuperAdmin && level ? () => setPendingDelete(level) : undefined}
                onEdit={
                  isSuperAdmin && level
                    ? () =>
                        setDraft({
                          id: level.id,
                          key: level.key,
                          label: level.label,
                          description: level.description ?? "",
                          xero_org_limit: level.xero_org_limit ?? 1,
                          allows_multi_org: !!level.allows_multi_org,
                          sort_order: level.sort_order ?? 100,
                          widgets: (level.widgets as string[]) ?? [],
                        })
                    : undefined
                }
              />
            );
          })}
        </main>
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit dashboard tier" : "New dashboard tier"}</DialogTitle>
            <DialogDescription>Name it and set how many Xero files it may link. Widgets are picked on the page.</DialogDescription>
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
                    {draft.id ? "Keys can't change once in use." : "Leave blank to build it from the name."}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="What this tier includes."
                />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Multiple Xero files</p>
                  <p className="text-xs text-muted-foreground">Allow a client on this tier to link more than one file.</p>
                </div>
                <Switch
                  checked={draft.allows_multi_org}
                  onCheckedChange={(v) =>
                    setDraft({
                      ...draft,
                      allows_multi_org: v,
                      xero_org_limit: v ? Math.max(2, draft.xero_org_limit) : 1,
                    })
                  }
                />
              </div>

              {draft.allows_multi_org && (
                <div className="space-y-1.5">
                  <Label>Xero files allowed</Label>
                  <Input
                    type="number"
                    min={2}
                    value={String(draft.xero_org_limit)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "");
                      setDraft({ ...draft, xero_org_limit: raw === "" ? 2 : Number(raw) });
                    }}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button
              onClick={() => draft && addMut.mutate(draft)}
              disabled={!draft?.label.trim() || addMut.isPending}
            >
              {addMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {draft?.id ? "Save tier" : "Add tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove “{pendingDelete?.label}”?</DialogTitle>
            <DialogDescription>
              Tiers in use by a client can't be removed — move those clients first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

export function TierEditor({
  tier,
  initial,
  saving,
  onSave,
  onReset,
  resetLabel,
  title,
  description,
  enabled,
  onToggleEnabled,
  toggleDisabled,
  onDelete,
  onEdit,
}: {
  tier: DashboardTier;
  initial: WidgetKey[];
  saving: boolean;
  onSave: (widgets: WidgetKey[]) => void;
  onReset?: () => void;
  resetLabel?: string;
  title?: string;
  description?: string;
  enabled?: boolean;
  onToggleEnabled?: (v: boolean) => void;
  toggleDisabled?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const [selected, setSelected] = useState<Set<WidgetKey>>(new Set(initial));
  useEffect(() => { setSelected(new Set(initial)); }, [initial.join(",")]);

  const dirty = useMemo(() => {
    const a = [...selected].sort().join(",");
    const b = [...initial].sort().join(",");
    return a !== b;
  }, [selected, initial]);

  function toggle(w: WidgetKey) {
    const next = new Set(selected);
    if (next.has(w)) next.delete(w); else next.add(w);
    setSelected(next);
  }

  const isOff = onToggleEnabled !== undefined && enabled === false;

  return (
    <section className={`rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] ${isOff ? "opacity-70" : ""}`}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-display text-lg font-semibold truncate">{title ?? TIER_LABEL[tier]}</h2>
          {onToggleEnabled && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {enabled ? "On" : "Off"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onToggleEnabled && (
            <Switch
              checked={!!enabled}
              onCheckedChange={onToggleEnabled}
              disabled={toggleDisabled}
              aria-label={`Toggle ${title ?? TIER_LABEL[tier]}`}
            />
          )}
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Edit tier">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Remove tier">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} disabled={saving || isOff}>
              {resetLabel ?? "Reset"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => onSave(ALL_WIDGETS.filter((w) => selected.has(w)))}
            disabled={!dirty || saving || isOff}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
          </Button>
        </div>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{description ?? TIER_DESCRIPTION[tier]}</p>
      <fieldset disabled={isOff} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ALL_WIDGETS.map((w) => (
          <label
            key={w}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <Checkbox checked={selected.has(w)} onCheckedChange={() => toggle(w)} />
            <span>{WIDGET_LABEL[w]}</span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
