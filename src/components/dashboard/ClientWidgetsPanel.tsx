import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientWidgets, saveClientWidgets } from "@/lib/tier-config.functions";
import { ALL_WIDGETS, WIDGET_LABEL, type WidgetKey } from "@/lib/tiers";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/** One list of cards per client, bounded by what the organisation's plan includes. */
export function ClientWidgetsPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const fetchWidgets = useServerFn(getClientWidgets);
  const save = useServerFn(saveClientWidgets);

  const q = useQuery({
    queryKey: ["client-widgets", clientId, "actual"],
    queryFn: () => fetchWidgets({ data: { clientId } }),
  });

  const [selected, setSelected] = useState<WidgetKey[] | null>(null);
  useEffect(() => {
    if (q.data) setSelected(q.data.widgets as WidgetKey[]);
  }, [q.data]);

  const mut = useMutation({
    mutationFn: (widgets: WidgetKey[] | null) => save({ data: { clientId, widgets } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["client-widgets", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading || !selected) {
    return (
      <div className="text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const available = new Set((q.data?.availableWidgets ?? []) as WidgetKey[]);
  const planLabel = q.data?.planLabel ?? "";

  function toggle(w: WidgetKey, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (on) next.add(w);
      else next.delete(w);
      return ALL_WIDGETS.filter((k) => next.has(k));
    });
  }

  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">
        Tick the cards this client sees on their dashboard.
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        Plan includes: {planLabel || "Standard"}
        {q.data?.configured ? "" : " · currently using the plan default"}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {ALL_WIDGETS.map((w) => {
          const allowed = available.has(w);
          return (
            <label
              key={w}
              className={`flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm ${
                allowed ? "cursor-pointer" : "cursor-not-allowed opacity-50"
              }`}
            >
              <Checkbox
                checked={selected.includes(w)}
                disabled={!allowed}
                onCheckedChange={(v) => toggle(w, v === true)}
              />
              <span className="min-w-0 truncate">{WIDGET_LABEL[w]}</span>
              {!allowed && <span className="ml-auto text-xs text-muted-foreground">Not in your plan</span>}
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={() => mut.mutate(selected)} disabled={mut.isPending}>
          {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
        </Button>
        {q.data?.configured && (
          <Button size="sm" variant="ghost" onClick={() => mut.mutate(null)} disabled={mut.isPending}>
            Reset to plan default
          </Button>
        )}
      </div>
    </div>
  );
}
