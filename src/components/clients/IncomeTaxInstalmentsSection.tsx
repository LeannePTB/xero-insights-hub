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
  clearIncomeTaxInstalment,
  listIncomeTaxInstalments,
  saveIncomeTaxInstalment,
  setIncomeTaxInstalmentFrequency,
  type IncomeTaxInstalment,
  type InstalmentFrequency,
} from "@/lib/income-tax-instalments.functions";
import { organisationToday, remainingFyQuarters, upcomingInstalmentPeriods, type InstalmentPeriod } from "@/components/dashboard/tax-obligations";
import { formatMoneyExact } from "@/components/dashboard/useTenantCurrency";

const day = (iso: string) => format(new Date(`${iso}T00:00:00`), "d MMM");
const parseAmount = (s: string): number | null | "invalid" => {
  const t = s.replace(/[$,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && Math.round(n * 100) === n * 100 ? n : "invalid";
};

/** Client settings → Tax & reporting. The only place instalments are entered.
 *  Saves go through audited, caller-scoped database functions; the server decides who may edit. */
export function IncomeTaxInstalmentsSection({ clientId, tenantId }: { clientId: string; tenantId?: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listIncomeTaxInstalments);
  const setFrequency = useServerFn(setIncomeTaxInstalmentFrequency);
  const q = useQuery({ queryKey: ["income-tax-instalments", clientId, tenantId], queryFn: () => list({ data: { clientId, tenantId: tenantId! } }), enabled: !!tenantId });
  const refresh = () => qc.invalidateQueries({ queryKey: ["income-tax-instalments", clientId] });
  const freqMut = useMutation({
    mutationFn: (frequency: InstalmentFrequency) => setFrequency({ data: { clientId, frequency } }),
    onSuccess: async () => { await refresh(); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenantId) return <p className="text-sm text-muted-foreground">Connect a Xero file to record instalments.</p>;
  if (q.isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : "Instalments unavailable."}</p>;
  const { canEdit, frequency, instalments } = q.data;
  const pays = frequency === "quarterly" || frequency === "annual";
  const today = organisationToday();

  return <div className="space-y-5 text-sm">
    <div className="space-y-2">
      <p className="font-medium">Does this client pay income tax instalments?</p>
      <div role="radiogroup" aria-label="Pays income tax instalments" className="flex flex-wrap gap-2">
        <Button type="button" role="radio" size="sm" aria-checked={pays} variant={pays ? "default" : "outline"} disabled={!canEdit || freqMut.isPending}
          onClick={() => { if (!pays) freqMut.mutate("quarterly"); }}>Yes</Button>
        <Button type="button" role="radio" size="sm" aria-checked={frequency === "not_required"} variant={frequency === "not_required" ? "default" : "outline"} disabled={!canEdit || freqMut.isPending}
          onClick={() => freqMut.mutate("not_required")}>No — not required</Button>
      </div>
      {pays && <div role="radiogroup" aria-label="How often" className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">How often:</span>
        {(["quarterly", "annual"] as const).map((f) => <Button key={f} type="button" role="radio" size="sm" aria-checked={frequency === f}
          variant={frequency === f ? "default" : "outline"} disabled={!canEdit || freqMut.isPending} onClick={() => freqMut.mutate(f)}>{f === "quarterly" ? "Quarterly" : "Annual"}</Button>)}
      </div>}
      {frequency === null && <p className="text-xs text-muted-foreground">Not chosen yet — the dashboard shows "Not entered yet" until someone chooses.</p>}
      {!canEdit && <p className="text-xs text-muted-foreground">Only the organisation team can change this.</p>}
    </div>

    {pays && <InstalmentAmounts key={frequency} clientId={clientId} tenantId={tenantId} frequency={frequency} today={today}
      instalments={instalments} canEdit={canEdit} onSaved={refresh} />}
  </div>;
}

function InstalmentAmounts({ clientId, tenantId, frequency, today, instalments, canEdit, onSaved }: {
  clientId: string; tenantId: string; frequency: "quarterly" | "annual"; today: string;
  instalments: IncomeTaxInstalment[]; canEdit: boolean; onSaved: () => Promise<void>;
}) {
  const save = useServerFn(saveIncomeTaxInstalment);
  const clear = useServerFn(clearIncomeTaxInstalment);
  const periods = upcomingInstalmentPeriods(frequency, today, 2);
  const saved = (p: InstalmentPeriod) => instalments.find((i) => i.periodStart === p.start && i.periodEnd === p.end) ?? null;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(periods.map((p) => [p.end, saved(p) ? String(saved(p)!.amount) : ""])));
  const [fill, setFill] = useState("");
  const money = (n: number) => formatMoneyExact(n, "AUD");

  const write = async (p: InstalmentPeriod, raw: string) => {
    const amount = parseAmount(raw);
    if (amount === "invalid") throw new Error("Enter a dollar amount, e.g. 1871 or 0.");
    if (amount === null) { if (saved(p)) await clear({ data: { clientId, tenantId, periodStart: p.start, periodEnd: p.end } }); return; }
    await save({ data: { clientId, tenantId, periodStart: p.start, periodEnd: p.end, amount } });
  };
  const rowMut = useMutation({
    mutationFn: (p: InstalmentPeriod) => write(p, values[p.end] ?? ""),
    onSuccess: async () => { await onSaved(); toast.success("Income tax instalment saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rest = frequency === "quarterly" ? remainingFyQuarters(today) : [];
  const fillMut = useMutation({
    mutationFn: async () => {
      if (parseAmount(fill) === null || parseAmount(fill) === "invalid") throw new Error("Enter a dollar amount to copy.");
      for (const p of rest) await write(p, fill);
    },
    onSuccess: async () => {
      setValues((v) => ({ ...v, ...Object.fromEntries(periods.filter((p) => rest.some((r) => r.end === p.end)).map((p) => [p.end, fill])) }));
      await onSaved(); toast.success(`Saved for ${rest.length} quarter${rest.length === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">Enter the amount from the ATO activity statement / instalment notice — Xero doesn't provide it. $0 means nothing to pay for that period; leave it empty if you don't know yet.</p>
    <ul className="divide-y divide-border rounded-md border border-border bg-card">
      {periods.map((p) => {
        const s = saved(p);
        return <li key={p.end} className="flex flex-col gap-2 px-3 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium">{p.label} · due {day(p.due)}</p>
            <p className="text-xs text-muted-foreground">{s ? (s.amount > 0.005 ? `Saved: ${money(s.amount)}` : "Saved: $0 — nothing owing") : "Not entered"}</p>
          </div>
          {canEdit && <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); rowMut.mutate(p); }}>
            <div className="space-y-1">
              <Label htmlFor={`iti-${p.end}`} className="text-xs">Amount (A$)</Label>
              <Input id={`iti-${p.end}`} className="w-36" inputMode="decimal" placeholder="Not entered" value={values[p.end] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [p.end]: e.target.value }))} />
            </div>
            <Button type="submit" disabled={rowMut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>
          </form>}
        </li>;
      })}
    </ul>
    {canEdit && rest.length > 1 && <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); fillMut.mutate(); }}>
      <div className="space-y-1">
        <Label htmlFor="iti-fill" className="text-xs">Same amount each quarter for the rest of this financial year ({rest.map((r) => r.label).join(", ")})</Label>
        <Input id="iti-fill" className="w-36" inputMode="decimal" placeholder="A$" value={fill} onChange={(e) => setFill(e.target.value)} />
      </div>
      <Button type="submit" variant="outline" disabled={fillMut.isPending}>Fill quarters</Button>
    </form>}
  </div>;
}
