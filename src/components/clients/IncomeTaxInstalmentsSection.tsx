import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listIncomeTaxInstalments,
  saveIncomeTaxInstalment,
  setIncomeTaxInstalmentFrequency,
  type InstalmentFrequency,
} from "@/lib/income-tax-instalments.functions";
import { formatMoneyExact } from "@/components/dashboard/useTenantCurrency";

const CHOICES: { value: InstalmentFrequency; label: string }[] = [
  { value: "not_required", label: "Not required" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

/** Moved from the dashboard card. Saves go through the same audited,
 *  caller-scoped database functions; the server decides who may edit. */
export function IncomeTaxInstalmentsSection({ clientId, tenantId }: { clientId: string; tenantId?: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listIncomeTaxInstalments);
  const save = useServerFn(saveIncomeTaxInstalment);
  const setFrequency = useServerFn(setIncomeTaxInstalmentFrequency);
  const key = ["income-tax-instalments", clientId, tenantId];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { clientId, tenantId: tenantId! } }), enabled: !!tenantId });
  const today = new Date();
  const qStart = Math.floor(today.getMonth() / 3) * 3;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [periodStart, setPeriodStart] = useState(iso(new Date(today.getFullYear(), qStart, 1)));
  const [periodEnd, setPeriodEnd] = useState(iso(new Date(today.getFullYear(), qStart + 3, 0)));
  const [amount, setAmount] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["income-tax-instalments", clientId] });

  const freqMut = useMutation({
    mutationFn: (frequency: InstalmentFrequency) => setFrequency({ data: { clientId, frequency } }),
    onSuccess: async () => { await refresh(); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveMut = useMutation({
    mutationFn: () => save({ data: { clientId, tenantId: tenantId!, periodStart, periodEnd, amount: Number(amount) } }),
    onSuccess: async () => { await refresh(); setAmount(""); toast.success("Income tax instalment saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenantId) return <p className="text-sm text-muted-foreground">Connect a Xero file to record instalments.</p>;
  if (q.isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">Instalments unavailable.</p>;
  const { canEdit, frequency, instalments } = q.data;
  const money = (n: number) => formatMoneyExact(n, "AUD");

  return <div className="space-y-5 text-sm">
    <div className="space-y-2">
      <p className="text-muted-foreground">Does this client pay income tax instalments to the ATO?</p>
      <div role="radiogroup" aria-label="Income tax instalments" className="flex flex-wrap gap-2">
        {CHOICES.map((c) => <Button key={c.value} type="button" role="radio" aria-checked={frequency === c.value} size="sm"
          variant={frequency === c.value ? "default" : "outline"} disabled={!canEdit || freqMut.isPending}
          onClick={() => freqMut.mutate(c.value)}>{c.label}</Button>)}
      </div>
      {frequency === null && <p className="text-xs text-muted-foreground">Not chosen yet — the dashboard shows "Not entered yet" until someone chooses.</p>}
      {!canEdit && <p className="text-xs text-muted-foreground">Only the organisation team can change this.</p>}
    </div>

    {frequency !== "not_required" && <>
      {canEdit && <form className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end" onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}>
        <div className="space-y-2"><Label htmlFor="iti-start">Period start</Label><Input id="iti-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="iti-end">Period end</Label><Input id="iti-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="iti-amount">ATO amount</Label><Input id="iti-amount" type="number" inputMode="decimal" min="0" max="999999999999.99" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        <Button type="submit" disabled={saveMut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>
      </form>}
      <div>
        <h3 className="text-sm font-medium">History</h3>
        {instalments.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">No instalments entered yet.</p> :
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">{instalments.map((i) =>
            <li key={i.id} className="flex justify-between gap-3 px-3 py-2"><span>{format(new Date(`${i.periodStart}T00:00:00`), "d MMM yyyy")} – {format(new Date(`${i.periodEnd}T00:00:00`), "d MMM yyyy")}</span><span className="tabular-nums">{money(i.amount)}</span></li>)}</ul>}
      </div>
    </>}
  </div>;
}
