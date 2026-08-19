import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { getBalanceSheetReconciliation } from "@/lib/xero/reconciliation.functions";

function fmt(n: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(n);
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Presets only — a free date picker invites a fetch per keystroke. */
function periodOptions(): { value: string; label: string }[] {
  const now = new Date();
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const opts = [
    { value: iso(thisMonthEnd), label: `This month end (${format(thisMonthEnd, "d MMM yyyy")})` },
    { value: iso(lastMonthEnd), label: `Last month end (${format(lastMonthEnd, "d MMM yyyy")})` },
  ];
  // The four Australian BAS quarter ends, most recent first.
  const quarters = [
    { m: 8, d: 30 }, // 30 September
    { m: 11, d: 31 }, // 31 December
    { m: 2, d: 31 }, // 31 March
    { m: 5, d: 30 }, // 30 June
  ];
  const ends: Date[] = [];
  for (const y of [now.getFullYear(), now.getFullYear() - 1]) {
    for (const q of quarters) {
      const d = new Date(y, q.m, q.d);
      if (d <= now) ends.push(d);
    }
  }
  ends.sort((a, b) => b.getTime() - a.getTime());
  for (const d of ends.slice(0, 4)) {
    const v = iso(d);
    if (!opts.some((o) => o.value === v)) {
      opts.push({ value: v, label: `Quarter end ${format(d, "d MMM yyyy")}` });
    }
  }
  return opts;
}

export function BalanceSheetReconciliationWidget({
  clientId,
  tenantId,
  tenantName,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
}) {
  const options = useMemo(periodOptions, []);
  const defaultAsAt = options[1]?.value ?? options[0]!.value; // last month end
  const [asAt, setAsAt] = useState(defaultAsAt);
  const fetchRecon = useServerFn(getBalanceSheetReconciliation);

  const q = useQuery({
    queryKey: ["bs-reconciliation", clientId, tenantId, asAt],
    queryFn: () => fetchRecon({ data: { clientId, tenantId, asAt } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const [recalculating, setRecalculating] = useState(false);
  async function recalculate() {
    setRecalculating(true);
    try {
      await fetchRecon({ data: { clientId, tenantId, asAt, recalculate: true } });
      await q.refetch();
    } finally {
      setRecalculating(false);
    }
  }

  const data = q.data;
  const rows = data?.rows ?? [];
  const variances = rows.filter((r) => r.status === "variance").length;
  const unavailable = rows.filter((r) => r.status === "unavailable").length;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Balance sheet reconciliation
          </h3>
          <p className="text-xs text-muted-foreground">
            Control accounts against their subledgers as at{" "}
            {format(new Date(`${asAt}T00:00:00`), "d MMMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={asAt} onValueChange={setAsAt}>
            <SelectTrigger className="h-8 w-[230px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data?.canRecalculate && (
            <Button variant="ghost" size="sm" onClick={recalculate} disabled={recalculating} title="Recalculate">
              <RefreshCw className={`h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </div>

      {q.isLoading || recalculating ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reconstructing the subledgers as at this date…
        </div>
      ) : q.error ? (
        <div className="mt-4">
          <XeroErrorNotice error={q.error} onRetry={() => q.refetch()} isRetrying={q.isFetching} />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {variances > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {variances} account{variances === 1 ? "" : "s"} out of balance
              </span>
            ) : unavailable === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> All control accounts reconcile
              </span>
            ) : null}
            {data && !data.complete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Incomplete — some data could not be loaded
              </span>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Account</th>
                  <th className="py-2 px-3 text-right font-semibold">General ledger</th>
                  <th className="py-2 px-3 text-right font-semibold">Subledger</th>
                  <th className="py-2 pl-3 text-right font-semibold">Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.label}</div>
                      {r.status === "unavailable" && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          Unavailable — {r.reason}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmt(r.glBalance)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmt(r.subledgerBalance)}</td>
                    <td
                      className={`py-2 pl-3 text-right tabular-nums font-semibold ${
                        r.status === "variance"
                          ? "text-destructive"
                          : r.status === "unavailable"
                            ? "text-muted-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {r.status === "unavailable" ? "—" : fmt(r.variance)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-muted-foreground">
                      No control accounts found for this organisation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {(data?.unreconciled.length ?? 0) > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Unreconciled items
              </p>
              <ul className="mt-2 space-y-2">
                {data!.unreconciled.map((u, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium">{u.label}</span>
                    {u.amount !== undefined && <span className="tabular-nums"> — {fmt(u.amount)}</span>}
                    <div className="text-muted-foreground">{u.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data?.issues.length ?? 0) > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-600 dark:text-amber-400">
              {data!.issues.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}

          {data?.generatedAt && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {data.fromSnapshot ? "Snapshot taken" : "Calculated"}{" "}
              {format(new Date(data.generatedAt), "d MMM yyyy, h:mm a")}
              {data.fromSnapshot ? " — figures are locked so they don't drift." : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
