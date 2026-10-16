import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatMoney } from "@/components/dashboard/useTenantCurrency";

/** One P&L comparison tile. Pure: also drawn on the public demo. */
export function PnlKpi({
  label,
  value,
  previous,
  higherIsBetter,
  currency = "AUD",
  priorLabel,
}: {
  label: string;
  value: number;
  previous: number;
  higherIsBetter: boolean;
  currency?: string;
  priorLabel?: string;
}) {
  const fmt = (n: number) => formatMoney(n, currency);
  const delta = value - previous;
  const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
  const up = delta > 0;
  const flat = delta === 0;
  const good = flat ? true : up ? higherIsBetter : !higherIsBetter;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const tone = flat ? "text-muted-foreground" : good ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-normal tabular-nums">{fmt(value)}</p>
      <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${tone}`}>
        <Icon className="h-3 w-3 shrink-0" />
        <span className="tabular-nums">
          {flat ? "No change" : `${up ? "+" : ""}${fmt(delta)}`}
          {pct !== null && !flat && (
            <span className="ml-1 text-muted-foreground">
              ({up ? "+" : ""}{pct.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
        Was {fmt(previous)}{priorLabel ? ` (${priorLabel})` : ""}
      </p>
    </div>
  );
}
