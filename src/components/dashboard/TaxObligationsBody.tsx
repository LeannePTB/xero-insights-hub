import type { ReactNode } from "react";
import { format } from "date-fns";
import type { ForwardTax, BillStatus } from "./tax-obligations";
import { billStatus } from "./tax-obligations";

export type InstalmentDisplay = "not_required" | "required";

const STATUS_CLASS: Record<BillStatus["kind"], string> = {
  not_due: "border-border text-muted-foreground",
  due_today: "border-info bg-info-surface text-info",
  overdue: "border-destructive text-destructive",
  paid: "border-border text-muted-foreground",
};

function StatusPill({ status }: { status: BillStatus }) {
  return <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status.kind]}`}>{status.label}{status.detail ? ` · ${status.detail}` : ""}</span>;
}

/** Presentation only: all amounts and deadlines come from the shared summary.
 *  Read-only: instalments are entered in Client settings → Tax & reporting. */
export function TaxObligationsBody({ forward, buildingLabel, money, partPaid, paygRegistered, today, instalmentDisplay = "required", settingsLink, details }: {
  forward: ForwardTax;
  buildingLabel: string;
  money: (amount: number) => string;
  partPaid: readonly boolean[];
  paygRegistered: boolean;
  /** Organisation calendar day (YYYY-MM-DD). */
  today: string;
  instalmentDisplay?: InstalmentDisplay;
  /** Practice users only: link to the settings section. */
  settingsLink?: ReactNode;
  details: ReactNode;
}) {
  const day = (date: string) => format(new Date(`${date}T00:00:00`), "d MMM");
  const estimate = (amount: number | null) => amount === null ? "Unavailable" : `~${money(amount)}`;
  const statuses = forward.owing.map((bill) => billStatus(bill.due, today, bill.amount));
  const overdue = statuses.some((s) => s.kind === "overdue");
  const instalmentStatus = forward.instalment ? billStatus(forward.instalment.due, today, forward.instalment.amount) : null;
  return <div className="mt-4 text-sm">
    <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3" data-tax-tiles>
      <section aria-label="Lodged" className={`min-w-0 rounded-md border bg-card p-4 ${overdue ? "border-destructive border-t-2" : "border-border"}`}>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Lodged</p>
        {forward.owing.length === 0 ? <p className="mt-3 font-semibold">Nothing owing</p> :
          <div className="mt-3 space-y-4">{forward.owing.map((bill, index) => <div key={`${bill.reference}:${bill.due}:${index}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-display text-2xl font-semibold tabular-nums ${statuses[index].kind === "overdue" ? "text-destructive" : "text-foreground"}`}>{money(bill.amount)}</p>
              <StatusPill status={statuses[index]} />
            </div>
            <p className="mt-1 text-xs">{bill.reference ? `${bill.reference} · ` : ""}due {day(bill.due)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{partPaid[index] ? "Lodged, part paid" : "Lodged, still owing"}</p>
          </div>)}</div>}
      </section>
      <section aria-label="Currently accruing" className="min-w-0 rounded-md border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Currently accruing ({buildingLabel})</p>
        <p className="mt-3 font-display text-2xl font-semibold tabular-nums break-words">{estimate(forward.building.total)}</p>
        <p className="mt-1 text-xs">due {day(forward.building.due)}</p>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>GST {estimate(forward.building.gst)}</p>
          {paygRegistered && <p>PAYG {estimate(forward.building.payg)}</p>}
        </div>
      </section>
      <section aria-label="Income tax instalment" className="flex min-w-0 flex-col rounded-md border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Income tax instalment</p>
        {instalmentDisplay === "not_required" ? <p className="mt-3 font-semibold">Not required</p>
          : forward.instalment && instalmentStatus ? (forward.instalment.amount > 0.005 ? <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="font-display text-2xl font-semibold tabular-nums break-words">{money(forward.instalment.amount)}</p>
              <StatusPill status={instalmentStatus} />
            </div>
            <p className="mt-1 text-xs">due {day(forward.instalment.due)}</p>
          </> : <>
            <p className="mt-3 font-semibold">Nothing owing</p>
            <p className="mt-1 text-xs text-muted-foreground">$0 instalment for the period due {day(forward.instalment.due)}</p>
          </>)
          </> : <>
            <p className="mt-3 font-semibold">Not entered yet</p>
            {settingsLink && <div className="mt-2 text-xs">{settingsLink}</div>}
          </>}
      </section>
    </div>
    <p className="mt-4 font-semibold">Total to plan for: {estimate(forward.totalToPlan)}</p>
    <details className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
      <summary className="w-fit cursor-pointer font-medium text-link">Details</summary>
      <div className="mt-3 space-y-2 leading-relaxed">{details}</div>
    </details>
  </div>;
}
