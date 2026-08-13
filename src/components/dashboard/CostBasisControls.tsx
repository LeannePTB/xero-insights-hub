import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  COST_GROUP_LABELS,
  type CostBasis,
  type CostGroup,
  type GroupBasis,
} from "@/lib/scenario-basis";

const MODES: { id: GroupBasis["mode"]; label: string }[] = [
  { id: "actual", label: "Actual" },
  { id: "avg", label: "3-mo avg" },
  { id: "override", label: "Override" },
];

export function CostBasisControls({
  basis,
  onChange,
  onReset,
  actuals,
  avg,
  fmt,
}: {
  basis: CostBasis;
  onChange: (group: CostGroup, next: GroupBasis) => void;
  onReset: () => void;
  actuals: Record<CostGroup, number>;
  avg: Record<CostGroup, number> | null;
  fmt: (n: number) => string;
}) {
  const groups: CostGroup[] = ["cogs", "fixed", "variable"];
  const anyModelled = groups.some((g) => basis[g].mode !== "actual");

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold">Cost assumptions</h3>
          <p className="text-xs text-muted-foreground">
            Model each expense group on the real figure, the 3-month average, or your own number.
          </p>
        </div>
        {anyModelled && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset to actual
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {groups.map((g) => {
          const setting = basis[g];
          return (
            <div key={g} className="rounded-xl border border-border/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {COST_GROUP_LABELS[g]}
              </p>
              <div className="mt-2 flex rounded-lg border border-border p-0.5">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChange(g, { ...setting, mode: m.id })}
                    className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      setting.mode === m.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {setting.mode === "override" ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Amount</label>
                    <Input
                      className="h-8 text-xs"
                      inputMode="decimal"
                      placeholder={String(Math.round(actuals[g]))}
                      value={setting.value ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        onChange(g, {
                          mode: "override",
                          value: raw === "" ? undefined : Number(raw),
                          pct: raw === "" ? setting.pct : undefined,
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">or % change</label>
                    <Input
                      className="h-8 text-xs"
                      inputMode="decimal"
                      placeholder="e.g. 10"
                      value={setting.pct ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        onChange(g, {
                          mode: "override",
                          pct: raw === "" || raw === "-" ? undefined : Number(raw),
                          value: undefined,
                        });
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                  Actual {fmt(actuals[g])}
                  {avg ? ` · 3-mo avg ${fmt(avg[g])}` : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
