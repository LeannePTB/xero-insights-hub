import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { getActivityStatement, getCurrentTaxBalance, getSuperPayable } from "@/lib/xero/reports.functions";
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
type ViewKey = "bas" | "balance";

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
  const currentQ = Math.floor(m / 3);
  const lastQStartMonth = (currentQ - 1) * 3;
  const from = new Date(currentQ === 0 ? y - 1 : y, currentQ === 0 ? 9 : lastQStartMonth, 1);
  const to = new Date(from.getFullYear(), from.getMonth() + 3, 0);
  const qNum = Math.floor(from.getMonth() / 3) + 1;
  return { from, to, label: `Q${qNum} ${from.getFullYear()} (${format(from, "MMM")}–${format(to, "MMM yyyy")})` };
}

const BOX_ORDER = ["G1", "G2", "G3", "G10", "G11", "1A", "1B", "W1", "W2", "W3", "W4", "W5", "T1", "T2", "T3", "T4", "5A", "5B", "6A", "6B", "7", "7A", "7C", "7D", "8A", "8B", "9"];
const BOX_LABEL: Record<string, string> = {
  G1: "Total sales (G1)",
  "1A": "GST on sales (1A)",
  "1B": "GST on purchases (1B)",
  W1: "Total wages (W1)",
  W2: "PAYG withheld (W2)",
  W3: "Other amounts withheld (W3)",
  W4: "Withheld where no ABN (W4)",
  W5: "Total withheld (W5)",
  "8A": "Total owed to ATO (8A)",
  "8B": "Total owed by ATO (8B)",
  "9": "Net payment (9)",
};

const CATEGORY_LABEL: Record<string, string> = {
  gst: "GST",
  payg: "PAYG",
  super: "Super",
  "other-tax": "Other tax",
};

export function TaxLiabilityWidget({ tenantId, tenantName, loadDelayMs = 0 }: { tenantId: string; tenantName: string; loadDelayMs?: number }) {
  const fetchActivity = useServerFn(getActivityStatement);
  const fetchSuper = useServerFn(getSuperPayable);
  const fetchBalance = useServerFn(getCurrentTaxBalance);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  const [view, setView] = useState<ViewKey>("bas");
  const [period, setPeriod] = useState<PeriodKey>("last-month");
  const range = periodRange(period);
  const fromIso = iso(range.from);
  const toIso = iso(range.to);
  const todayIso = iso(new Date());

  const activityQ = useQuery({
    queryKey: ["xero-activity", tenantId, fromIso, toIso],
    queryFn: () => fetchActivity({ data: { tenantId, fromDate: fromIso, toDate: toIso } }),
    enabled: shouldLoad && view === "bas",
    retry: false,
  });
  const superQ = useQuery({
    queryKey: ["xero-super", tenantId, toIso],
    queryFn: () => fetchSuper({ data: { tenantId, date: toIso } }),
    enabled: shouldLoad && view === "bas",
    retry: false,
  });
  const balanceQ = useQuery({
    queryKey: ["xero-tax-balance", tenantId, todayIso],
    queryFn: () => fetchBalance({ data: { tenantId, date: todayIso } }),
    enabled: shouldLoad && view === "balance",
    retry: false,
  });

  const isLoading = view === "bas"
    ? (activityQ.isLoading || superQ.isLoading)
    : balanceQ.isLoading;
  const isFetching = view === "bas"
    ? (activityQ.isFetching || superQ.isFetching)
    : balanceQ.isFetching;
  const error = view === "bas" ? activityQ.error : balanceQ.error;

  const refetch = () => {
    if (view === "bas") {
      activityQ.refetch();
      superQ.refetch();
    } else {
      balanceQ.refetch();
    }
  };

  const data = activityQ.data;
  const supr = superQ.data;
  const bal = balanceQ.data;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold">Tax and Superannuation liabilities</h3>
          <p className="text-xs text-muted-foreground">
            {view === "bas"
              ? <>Activity Statement for {range.label}{data?.basis ? ` · ${data.basis === "cash" ? "Cash basis" : "Accrual basis"}` : ""}</>
              : <>Live balance as at {format(new Date(), "d MMM yyyy")}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={view} onValueChange={(v) => setView(v as ViewKey)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bas">Activity Statement</SelectItem>
              <SelectItem value="balance">Current balance</SelectItem>
            </SelectContent>
          </Select>
          {view === "bas" && (
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
          )}
          <Button variant="ghost" size="sm" onClick={() => { setShouldLoad(true); refetch(); }} disabled={isFetching} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {!shouldLoad ? (
        <XeroLoadPrompt
          label="Load tax data"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => setShouldLoad(true)}
        />
      ) : isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <XeroErrorNotice error={error} onRetry={refetch} isRetrying={isFetching} />
      ) : view === "bas" && data ? (
        !data.available ? (
          <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
            {data.message ?? "Activity Statement isn't available for this organisation."}
          </p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
              <TaxKpi label="GST on sales (1A)" value={data.boxes["1A"] ?? 0} />
              <TaxKpi label="GST on purchases (1B)" value={data.boxes["1B"] ?? 0} />
              <TaxKpi
                label={data.netGst >= 0 ? "Net GST payable" : "Net GST refund"}
                value={Math.abs(data.netGst)}
              />
              <TaxKpi label="PAYG withheld (W2)" value={data.boxes["W2"] ?? 0} />
              <TaxKpi label="Super payable" value={supr?.balance ?? 0} />
              <TaxKpi
                label={data.netPayment >= 0 ? "Net BAS payment (9)" : "Net BAS refund (9)"}
                value={Math.abs(data.netPayment)}
                emphasis
              />
            </div>

            {data.lines.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  BAS breakdown
                </p>
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
                  {[...data.lines]
                    .sort((a, b) => {
                      const ia = BOX_ORDER.indexOf(a.code);
                      const ib = BOX_ORDER.indexOf(b.code);
                      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                    })
                    .map((l) => (
                      <li key={l.code} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{BOX_LABEL[l.code] ?? l.label}</span>
                          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {l.code}
                          </span>
                        </div>
                        <span className="shrink-0 font-medium tabular-nums">{fmt(l.amount)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {supr && supr.lines.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Superannuation payable (as at {format(range.to, "d MMM yyyy")})
                </p>
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
                  {supr.lines.map((l) => (
                    <li key={l.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{l.name}</span>
                      </div>
                      <span className="shrink-0 font-medium tabular-nums">{fmt(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      ) : view === "balance" && bal ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <TaxKpi label="GST Payable" value={bal.gst} />
            <TaxKpi label="PAYG Withholding" value={bal.payg} />
            <TaxKpi label="Super Payable" value={bal.superannuation} />
            <TaxKpi label="Total" value={bal.total} emphasis />
          </div>

          {bal.lines.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
              No GST, PAYG or super accounts found on the balance sheet.
            </p>
          ) : (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Breakdown
              </p>
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
                {bal.lines.map((l) => (
                  <li key={l.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{l.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {CATEGORY_LABEL[l.category] ?? l.category}
                      </span>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">{fmt(l.amount)}</span>
                  </li>
                ))}
              </ul>
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
