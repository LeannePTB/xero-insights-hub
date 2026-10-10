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
import { latestCompletedPaygMonth, netGstAmount } from "./tax-obligations";
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
    queryFn: () => fetchGst({ data: { clientId, tenantId, asAt: gstPeriod.asAt, window: gstPeriod.kind } }),
    retry: false,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: gstCycle !== "not_registered",
  });
  const paygQuery = useQuery({
    queryKey: paygQueryKey(tenantId, clientId),
    queryFn: () => fetchPayg({ data: { tenantId, clientId, months: 6 } }),
    ...paygQueryLimits,
    enabled: paygRegistered,
  });
  const instalmentsQuery = useQuery({
    queryKey: ["income-tax-instalments", clientId, tenantId],
    queryFn: () => listInstalments({ data: { clientId, tenantId } }),
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
  const latestInstalment = instalmentsQuery.data?.instalments[0] ?? null;
  const busy = gstQuery.isLoading || paygQuery.isLoading || instalmentsQuery.isLoading;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tenantName}</p>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Calculator className="h-4 w-4 text-primary" /> Tax obligations
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Latest completed periods and the ATO-set instalment</p>
        </div>
        {instalmentsQuery.data?.canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Add instalment
          </Button>
        )}
      </div>

      {busy ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">GST</p>
            <p className="mt-1 font-display text-lg font-semibold tabular-nums">{gst ? money(netGstAmount(gst)) : "Unavailable"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{gst ? periodLabel(gst.periodFrom, gst.periodTo) : "Latest completed period"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">PAYG withholding</p>
            <p className="mt-1 font-display text-lg font-semibold tabular-nums">{payg ? money(payg.amount) : "Unavailable"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{payg ? format(new Date(`${payg.month}T00:00:00`), "MMMM yyyy") : "Latest completed month"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Income tax instalment</p>
            <p className="mt-1 font-display text-lg font-semibold tabular-nums">{latestInstalment ? money(latestInstalment.amount) : "Not entered"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{latestInstalment ? periodLabel(latestInstalment.periodStart, latestInstalment.periodEnd) : "ATO-set amount"}</p>
          </div>
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
