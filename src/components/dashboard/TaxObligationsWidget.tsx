import { staggered, xeroQueryRetry } from "@/lib/xero/live-load";
import { DashboardCardHeader } from "./DashboardCardHeader";
import { paygQueryKey, paygQueryLimits } from "./payg-query";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Calculator, Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getGstReconciliation } from "@/lib/xero/gst.functions";
import { getPaygWithholdingPosition } from "@/lib/xero/reports.functions";
import {
  listIncomeTaxInstalments,
  saveIncomeTaxInstalment,
} from "@/lib/income-tax-instalments.functions";
import { completedGstPeriod, type GstCycle } from "./recon-periods";
import { latestCompletedPaygMonth, netGstAmount, currentGstPeriod, forwardTax, basDueDate } from "./tax-obligations";
import { getLodgedTaxBills } from "@/lib/xero/lodged-tax.functions";
import { formatMoneyExact, useTenantCurrency } from "./useTenantCurrency";

function periodLabel(from: string, to: string) {
  const start = format(new Date(`${from}T00:00:00`), "d MMM");
  const end = format(new Date(`${to}T00:00:00`), "d MMM yyyy");
  return `${start} – ${end}`;
}

export function TaxObligationsWidget({
  clientId,
  tenantId,
  tenantName,
  gstCycle,
  paygRegistered,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
  gstCycle: GstCycle | null;
  paygRegistered: boolean;
}) {
  const queryClient = useQueryClient();
  const fetchGst = useServerFn(getGstReconciliation);
  const fetchPayg = useServerFn(getPaygWithholdingPosition);
  const fetchBills = useServerFn(getLodgedTaxBills);
  const listInstalments = useServerFn(listIncomeTaxInstalments);
  const saveInstalment = useServerFn(saveIncomeTaxInstalment);
  const currency = useTenantCurrency(tenantId);
  const money = (value: number) => formatMoneyExact(value, currency);
  const gstPeriod = useMemo(() => completedGstPeriod(gstCycle), [gstCycle]);
  const today = new Date();
  const initialPeriodStart = `${today.getFullYear()}-${String(Math.floor(today.getMonth() / 3) * 3 + 1).padStart(2, "0")}-01`;
  const [editing, setEditing] = useState(false);
  const [periodStart, setPeriodStart] = useState(initialPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(() => {
    const end = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 0);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  });
  const [amount, setAmount] = useState("");

  const gstQuery = useQuery({
    queryKey: ["gst-reconciliation", clientId, tenantId, gstPeriod.kind, gstPeriod.asAt],
    queryFn: () => staggered(() => fetchGst({ data: { clientId, tenantId, asAt: gstPeriod.asAt, window: gstPeriod.kind } })),
    ...xeroQueryRetry,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: gstCycle !== "not_registered",
  });
  const todayIso = format(today, "yyyy-MM-dd");
  const runPeriod = useMemo(() => currentGstPeriod(gstCycle, todayIso), [gstCycle, todayIso]);
  const runGstQuery = useQuery({
    queryKey: ["gst-reconciliation", clientId, tenantId, runPeriod.kind, runPeriod.asAt],
    queryFn: () => staggered(() => fetchGst({ data: { clientId, tenantId, asAt: runPeriod.asAt, window: runPeriod.kind } })),
    ...xeroQueryRetry,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: gstCycle !== "not_registered" && gstCycle !== null,
  });
  const paygQuery = useQuery({
    queryKey: paygQueryKey(tenantId, clientId),
    queryFn: () => staggered(() => fetchPayg({ data: { tenantId, clientId, months: 6 } })),
    ...paygQueryLimits,
    ...xeroQueryRetry,
    enabled: paygRegistered,
  });
  const instalmentsQuery = useQuery({
    queryKey: ["income-tax-instalments", clientId, tenantId],
    queryFn: () => listInstalments({ data: { clientId, tenantId } }),
  });
  const billsQuery = useQuery({
    queryKey: ["lodged-tax-bills", tenantId, "tax_obligations"],
    queryFn: () => fetchBills({ data: { tenantId, widget: "tax_obligations" } }),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const saveMutation = useMutation({
    mutationFn: () => saveInstalment({
      data: { clientId, tenantId, periodStart, periodEnd, amount: Number(amount) },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["income-tax-instalments", clientId, tenantId] });
      setEditing(false);
      setAmount("");
      toast.success("Income tax instalment saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const gst = gstQuery.data;
  const payg = latestCompletedPaygMonth(paygQuery.data);
  const run = runGstQuery.data;
  const runPayg = paygQuery.data?.status === "available"
    ? paygQuery.data.months.find((m) => m.month.slice(0, 7) === todayIso.slice(0, 7))?.withheld ?? 0
    : null;
  const latestInstalment = instalmentsQuery.data?.instalments[0] ?? null;
  const fwd = forwardTax({
    bills: billsQuery.data?.bills ?? [], today: todayIso, period: runPeriod,
    gst: run ? (run.statementNet ?? netGstAmount(run)) : null, payg: runPayg, paygRegistered,
    instalment: latestInstalment ? { amount: latestInstalment.amount, due: basDueDate("quarter", latestInstalment.periodEnd) } : null,
  });
  const day = (d: string) => format(new Date(`${d}T00:00:00`), "d MMM");
  const accountGap = run && run.closingBalance !== null && run.statementNet !== null ? Math.round((run.closingBalance - run.statementNet) * 100) / 100 : null;
  const busy = gstQuery.isLoading || paygQuery.isLoading || instalmentsQuery.isLoading || runGstQuery.isLoading;

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="Tax obligations" icon={<Calculator className="h-4 w-4"/>} description="What still has to be paid to the ATO" source={paygQuery.data?.source} isFetching={gstQuery.isFetching || paygQuery.isFetching || runGstQuery.isFetching} actions={instalmentsQuery.data?.canEdit && !editing ? <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4"/> Add instalment</Button> : undefined}/>
      {billsQuery.isError && <p className="mt-2 text-xs text-muted-foreground">Lodged bill status unavailable</p>}
      {busy ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="mt-2 space-y-2 text-sm">
          {fwd.owing.map((o, i) => (
            <p key={`${o.reference}:${o.due}:${i}`} className={o.overdue ? "font-medium text-destructive" : "font-medium"}>
              Lodged and still owing: {money(o.amount)}{o.reference ? ` · ${o.reference}` : ""} · {o.overdue ? `overdue since ${day(o.due)}` : `due ${day(o.due)}`}
            </p>
          ))}
          <p>
            Building now ({runPeriod.kind === "quarter" ? `quarter ${day(fwd.building.from)} – ${day(fwd.building.to)}` : `${format(new Date(`${fwd.building.from}T00:00:00`), "MMMM")} so far`}):{" "}
            GST {fwd.building.gst === null ? "unavailable" : `~${money(fwd.building.gst)}`}
            {paygRegistered && <> · PAYG withholding {fwd.building.payg === null ? "unavailable" : `~${money(fwd.building.payg)}`}</>}
            {fwd.building.total !== null && <> · total ~{money(fwd.building.total)}</>} · due {day(fwd.building.due)}
          </p>
          <p>Income tax instalment: {fwd.instalment ? `${money(fwd.instalment.amount)} · due ${day(fwd.instalment.due)}` : "Not entered — add instalment"}</p>
          <p className="font-semibold">Total to plan for: {fwd.totalToPlan === null ? "unavailable" : `~${money(fwd.totalToPlan)}`}</p>
          {run?.unfiled?.status === "estimate" && run.unfiled.sales - run.unfiled.purchases !== 0 && (
            <p className="text-xs text-muted-foreground">GST includes an estimated {money(run.unfiled.sales - run.unfiled.purchases)} of unfiled amounts from earlier periods.</p>
          )}
          {accountGap !== null && Math.abs(accountGap) >= 1 && (
            <p className="text-xs text-muted-foreground">GST account holds {money(Math.abs(accountGap))} {accountGap > 0 ? "more" : "less"} than this period's GST — worth checking in Xero.</p>
          )}
          <p className="pt-1 text-xs text-muted-foreground">
            Last lodged period: {gst ? `${periodLabel(gst.periodFrom, gst.periodTo)} · GST ${money(netGstAmount(gst))}` : "GST unavailable"}
            {payg ? ` · PAYG ${money(payg.amount)} (${format(new Date(`${payg.month}T00:00:00`), "MMM yyyy")})` : ""}
          </p>
        </div>
      )}

      {editing && (
        <form
          className="mt-6 grid gap-4 border-t border-border pt-5 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="space-y-2"><Label htmlFor={`${tenantId}-tax-start`}>Period start</Label><Input id={`${tenantId}-tax-start`} type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor={`${tenantId}-tax-end`}>Period end</Label><Input id={`${tenantId}-tax-end`} type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor={`${tenantId}-tax-amount`}>ATO amount</Label><Input id={`${tenantId}-tax-amount`} type="number" inputMode="decimal" min="0" max="999999999999.99" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" disabled={saveMutation.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button></div>
        </form>
      )}
    </div>
  );
}
