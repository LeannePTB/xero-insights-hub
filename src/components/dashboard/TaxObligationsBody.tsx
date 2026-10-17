import type { ReactNode } from "react";
import { format } from "date-fns";
import type { ForwardTax, BillStatus } from "./tax-obligations";
import { billStatus } from "./tax-obligations";
import { TONE, PILL_BASE, billTone, worstTone } from "./status-tone";
import type { CheckStatus } from "@/lib/health/health-checks";

export type InstalmentDisplay = "not_required" | "required";

function StatusPill({ status }: { status: BillStatus }) {
  return <span className={`${PILL_BASE} ${TONE[billTone(status.kind)].pill}`}>{status.label}{status.detail ? ` · ${status.detail}` : ""}</span>;
}

function TilePill({ tone, text }: { tone: CheckStatus; text: string }) {
  return <span className={`${PILL_BASE} ${TONE[tone].pill}`}>{text}</span>;
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
  const unlodged = forward.owing.length ? [] : (forward.unlodged ?? []);
  const unlodgedStatuses = unlodged.map((u) => billStatus(u.due, today, u.amount));
  const splitDue = !!(paygRegistered && forward.building.gstDue && forward.building.paygDue && forward.building.gstDue !== forward.building.paygDue);
  const periodName = (from: string, to: string) => from.slice(0, 7) === to.slice(0, 7) ? format(new Date(`${from}T00:00:00`), "MMM yyyy") : `${format(new Date(`${from}T00:00:00`), "MMM")}–${format(new Date(`${to}T00:00:00`), "MMM yyyy")}`;
  const instalmentStatus = forward.instalment ? billStatus(forward.instalment.due, today, forward.instalment.amount) : null;
  const lodgedTone: CheckStatus = forward.owing.length ? worstTone(statuses.map((x) => billTone(x.kind))) : unlodged.length ? worstTone(unlodgedStatuses.map((x) => billTone(x.kind))) : "green";
  const lodgedPill = forward.owing.length === 0 && unlodged.length === 0 ? "Nothing owing" : lodgedTone === "red" ? "Overdue" : lodgedTone === "green" ? "Paid" : [...statuses, ...unlodgedStatuses].some((x) => x.kind === "due_today") ? "Due today" : "Not due yet";
  const instTone: CheckStatus = instalmentDisplay === "not_required" || !instalmentStatus ? "na" : billTone(instalmentStatus.kind);
  const instPill = instalmentDisplay === "not_required" ? "Not required" : !instalmentStatus ? "Not entered" : instalmentStatus.kind === "paid" ? (forward.instalment!.amount > 0.005 ? "Paid" : "Nothing owing") : instalmentStatus.label;
  const head = (label: string, tone: CheckStatus, pill: string) => <div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><TilePill tone={tone} text={pill} /></div>;
  return <div className="mt-4 text-sm">
    <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3" data-tax-tiles>
      <section aria-label="Lodged" data-tone={lodgedTone} className={`min-w-0 rounded-md border p-4 ${TONE[lodgedTone].box}`}>
        {head("Lodged", lodgedTone, lodgedPill)}
        {forward.owing.length === 0 && unlodged.length > 0 ? <div className="mt-3 space-y-3">
            <p className="text-xs font-medium">Finished period{unlodged.length > 1 ? "s" : ""} — not lodged in Xero</p>
            {unlodged.map((u, index) => <div key={u.kind}>
              <div className="flex flex-wrap items-center gap-2">
                <p className={`font-display text-xl font-semibold tabular-nums ${unlodgedStatuses[index].kind === "overdue" ? "text-health-alert" : "text-foreground"}`}>{u.kind === "gst" ? "GST" : "PAYG"} ~{money(u.amount)}</p>
                <StatusPill status={unlodgedStatuses[index]} />
              </div>
              <p className="mt-1 text-xs">{periodName(u.from, u.to)} · due {day(u.due)}{u.estimate ? " · estimate (today's balance)" : ""}</p>
            </div>)}
            <p className="text-xs text-muted-foreground">From Xero balances, not a lodged statement.</p>
          </div>
          : forward.owing.length === 0 ? <p className="mt-3 font-semibold">Nothing owing</p> :
          <div className="mt-3 space-y-4">{forward.owing.map((bill, index) => <div key={`${bill.reference}:${bill.due}:${index}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-display text-2xl font-semibold tabular-nums ${statuses[index].kind === "overdue" ? "text-health-alert" : "text-foreground"}`}>{money(bill.amount)}</p>
              <StatusPill status={statuses[index]} />
            </div>
            <p className="mt-1 text-xs">{bill.reference ? `${bill.reference} · ` : ""}due {day(bill.due)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{partPaid[index] ? "Lodged, part paid" : "Lodged, still owing"}</p>
          </div>)}</div>}
      </section>
      <section aria-label="Currently accruing" data-tone="watch" className={`min-w-0 rounded-md border p-4 ${TONE.watch.box}`}>
        {head(`Currently accruing (${buildingLabel})`, "watch", "Accruing")}
        <p className="mt-3 font-display text-2xl font-semibold tabular-nums break-words">{estimate(forward.building.total)}</p>
        {splitDue ? null : <p className="mt-1 text-xs">due {day(forward.building.due)}</p>}
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>GST {estimate(forward.building.gst)}{splitDue ? ` · due ${day(forward.building.gstDue!)}` : ""}</p>
          {paygRegistered && <p>PAYG {estimate(forward.building.payg)}{splitDue ? ` · due ${day(forward.building.paygDue!)}` : ""}</p>}
          {forward.building.paygPayRuns != null && forward.building.payg != null && <p>Pay runs show PAYG {money(forward.building.paygPayRuns)}; the Xero PAYG account moved {money(forward.building.payg)} (difference {money(Math.abs(forward.building.paygPayRuns - forward.building.payg))}) — check the PAYG account in Xero.</p>}
        </div>
      </section>
      <section aria-label="Income tax instalment" data-tone={instTone} className={`flex min-w-0 flex-col rounded-md border p-4 ${TONE[instTone].box}`}>
        {head("Income tax instalment", instTone, instPill)}
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
          </>) : <>
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
