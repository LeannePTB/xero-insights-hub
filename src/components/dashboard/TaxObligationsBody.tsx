import type { ReactNode } from "react";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ForwardTax } from "./tax-obligations";

/** Presentation only: all amounts and deadlines come from the shared summary. */
export function TaxObligationsBody({ forward, buildingLabel, money, partPaid, addInstalment, details }: {
  forward: ForwardTax;
  buildingLabel: string;
  money: (amount: number) => string;
  partPaid: readonly boolean[];
  addInstalment?: () => void;
  details: ReactNode;
}) {
  const day = (date: string) => format(new Date(`${date}T00:00:00`), "d MMM");
  const estimate = (amount: number | null) => amount === null ? "Unavailable" : `~${money(amount)}`;
  const overdue = forward.owing.some((bill) => bill.overdue);
  return <div className="mt-4 text-sm">
    <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3" data-tax-tiles>
      <section aria-label="Due now" className={`min-w-0 rounded-md border bg-background p-4 ${overdue ? "border-destructive border-t-2" : "border-border"}`}>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Due now</p>
        {forward.owing.length === 0 ? <p className="mt-3 font-semibold">Nothing due now</p> :
          <div className="mt-3 space-y-4">{forward.owing.map((bill, index) => <div key={`${bill.reference}:${bill.due}:${index}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-display text-2xl font-semibold tabular-nums ${bill.overdue ? "text-destructive" : "text-foreground"}`}>{money(bill.amount)}</p>
              {bill.overdue && <span className="rounded border border-destructive px-2 py-0.5 text-xs font-semibold text-destructive">Overdue</span>}
            </div>
            <p className="mt-1 text-xs">{bill.reference ? `${bill.reference} · ` : ""}due {day(bill.due)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{partPaid[index] ? "Lodged, part paid" : "Lodged, still owing"}</p>
          </div>)}</div>}
      </section>
      <section aria-label="Building" className="min-w-0 rounded-md border border-border bg-background p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Building ({buildingLabel})</p>
        <p className="mt-3 font-display text-2xl font-semibold tabular-nums break-words">{estimate(forward.building.total)}</p>
        <p className="mt-1 text-xs">due {day(forward.building.due)}</p>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>GST {estimate(forward.building.gst)}</p>
          {forward.building.payg !== null && <p>PAYG {estimate(forward.building.payg)}</p>}
        </div>
      </section>
      <section aria-label="Income tax instalment" className="flex min-w-0 flex-col rounded-md border border-border bg-background p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Income tax instalment</p>
        {forward.instalment ? <>
          <p className="mt-3 font-display text-2xl font-semibold tabular-nums break-words">{money(forward.instalment.amount)}</p>
          <p className="mt-1 text-xs">due {day(forward.instalment.due)}</p>
        </> : <p className="mt-3 font-semibold">Not entered</p>}
        {addInstalment && <Button variant="link" size="sm" className="mt-2 h-8 self-start px-0 text-link" onClick={addInstalment}><Pencil className="h-3.5 w-3.5" />Add instalment</Button>}
      </section>
    </div>
    <p className="mt-4 font-semibold">Total to plan for: {estimate(forward.totalToPlan)}</p>
    <details className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
      <summary className="w-fit cursor-pointer font-medium text-link">Details</summary>
      <div className="mt-3 space-y-2 leading-relaxed">{details}</div>
    </details>
  </div>;
}