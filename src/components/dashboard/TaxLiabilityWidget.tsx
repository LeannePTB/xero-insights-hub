import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { getTaxLiabilities } from "@/lib/xero/reports.functions";
import { Loader2, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function iso(d: Date) {
  return format(d, "yyyy-MM-dd");
}

type PeriodKey = "current-month" | "last-month" | "last-quarter";

function periodRange(key: PeriodKey): { from: Date; to: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (key === "current-month") {
    const from = new Date(y, m, 1);
    return { from, to: now, label: `${format(from, "MMM yyyy")} (MTD)` };
  }
  if (key === "last-month") {
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0);
    return { from, to, label: format(from, "MMMM yyyy") };
  }
  // last quarter: BAS quarters Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec
  const currentQ = Math.floor(m / 3);
  const lastQStartMonth = (currentQ - 1) * 3;
  const from = new Date(currentQ === 0 ? y - 1 : y, currentQ === 0 ? 9 : lastQStartMonth, 1);
  const to = new Date(from.getFullYear(), from.getMonth() + 3, 0);
  const qNum = Math.floor(from.getMonth() / 3) + 1;
  return { from, to, label: `Q${qNum} ${from.getFullYear()} (${format(from, "MMM")}–${format(to, "MMM yyyy")})` };
}

const categoryLabel: Record<string, string> = {
  gst: "GST",
  payg: "PAYG",
  super: "Super",
  "other-tax": "Other tax",
};

export function TaxLiabilityWidget({ tenantId, tenantName, loadDelayMs = 0 }: { tenantId: string; tenantName: string; loadDelayMs?: number }) {
  const fetchTax = useServerFn(getTaxLiabilities);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  const [period, setPeriod] = useState<PeriodKey>("last-month");
  const [mode, setMode] = useState<"balance" | "movement">("movement");
  const range = periodRange(period);
  const asAtIso = iso(range.to);
  const fromIso = iso(range.from);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-tax", tenantId, asAtIso, fromIso, mode],
    queryFn: () => fetchTax({ data: { tenantId, date: asAtIso, fromDate: fromIso, mode } }),
    enabled: shouldLoad,
    retry: false,
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold">Tax and Superannuation liabilities</h3>
          <p className="text-xs text-muted-foreground">
            {mode === "movement"
              ? `Movement for ${range.label} (BAS basis)`
              : `Balance as at ${format(range.to, "d MMM yyyy")}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month">Current month</SelectItem>
              <SelectItem value="last-month">Last month</SelectItem>
              <SelectItem value="last-quarter">Last quarter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={mode} onValueChange={(v) => setMode(v as "balance" | "movement")}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="movement">Period (BAS)</SelectItem>
              <SelectItem value="balance">Balance</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setShouldLoad(true); refetch(); }} disabled={isFetching} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>


      {!shouldLoad ? (
        <XeroLoadPrompt
          label="Load tax balances"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => setShouldLoad(true)}
        />
      ) : isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tax balances…
        </div>
      ) : error ? (
        <XeroErrorNotice error={error} onRetry={() => refetch()} isRetrying={isFetching} />
      ) : data ? (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <TaxKpi label="GST" value={data.gst} />
            <TaxKpi label="PAYG" value={data.payg} />
            <TaxKpi label="Total" value={data.totalTaxLiability} emphasis />
          </div>

          {data.lines.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
              No GST or PAYG accounts found on the balance sheet for this month.
            </p>
          ) : (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Breakdown
              </p>
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
                {data.lines.map((l) => (
                  <li key={l.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{l.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {categoryLabel[l.category] ?? l.category}
                      </span>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">{fmt(l.amount)}</span>
                  </li>
                ))}
              </ul>
              {data.superannuation > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Includes superannuation payable of {fmt(data.superannuation)}.
                </p>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function TaxKpi({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        emphasis ? "border-primary/30 bg-primary/5" : "border-border/60 bg-background"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{fmt(value)}</p>
    </div>
  );
}
