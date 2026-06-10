import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/roles.functions";
import { listTierConfig, saveTierWidgets } from "@/lib/tier-config.functions";
import { ALL_TIERS, ALL_WIDGETS, TIER_LABEL, TIER_DESCRIPTION, WIDGET_LABEL, type DashboardTier, type WidgetKey } from "@/lib/tiers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/tiers")({
  head: () => ({ meta: [{ title: "Tier widgets — Traction Advisory" }] }),
  component: TierSettings,
});

function TierSettings() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getMyContext);
  const fetchCfg = useServerFn(listTierConfig);
  const saveFn = useServerFn(saveTierWidgets);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const cfgQ = useQuery({
    queryKey: ["tier-config", null],
    queryFn: () => fetchCfg({ data: { clientId: null } }),
  });

  const isAdvisor = ctxQ.data?.isAdvisor ?? false;

  const saveMut = useMutation({
    mutationFn: ({ tier, widgets }: { tier: DashboardTier; widgets: WidgetKey[] }) =>
      saveFn({ data: { clientId: null, tier, widgets } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["tier-config"] });
      qc.invalidateQueries({ queryKey: ["effective-widgets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (ctxQ.isLoading || cfgQ.isLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!isAdvisor) return <p className="p-6 text-sm text-destructive">Advisors only.</p>;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> All clients</Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard tier widgets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick which widgets each tier shows. These are the defaults — you can override per client in that client's settings.
          </p>
        </div>

        {ALL_TIERS.map((tier) => (
          <TierEditor
            key={tier}
            tier={tier}
            initial={cfgQ.data?.global[tier] ?? []}
            saving={saveMut.isPending}
            onSave={(widgets) => saveMut.mutate({ tier, widgets })}
          />
        ))}
      </main>
    </div>
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
}: {
  tier: DashboardTier;
  initial: WidgetKey[];
  saving: boolean;
  onSave: (widgets: WidgetKey[]) => void;
  onReset?: () => void;
  resetLabel?: string;
  title?: string;
  description?: string;
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

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{title ?? TIER_LABEL[tier]}</h2>
        <div className="flex items-center gap-2">
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
              {resetLabel ?? "Reset"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => onSave(ALL_WIDGETS.filter((w) => selected.has(w)))}
            disabled={!dirty || saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
          </Button>
        </div>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{description ?? TIER_DESCRIPTION[tier]}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ALL_WIDGETS.map((w) => (
          <label
            key={w}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <Checkbox checked={selected.has(w)} onCheckedChange={() => toggle(w)} />
            <span>{WIDGET_LABEL[w]}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
