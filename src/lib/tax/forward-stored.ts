// Pure: the ONE forward-looking tax summary built from stored inputs. The
// Tax obligations card, Business Health's next-tax line, the Overview tax rule
// and column, and the monthly report all read these figures, so they agree.
import { currentGstPeriod, forwardTax, basDueDate, netGstAmount, type ForwardTax } from "@/components/dashboard/tax-obligations";
import { lodgedAtoBills } from "@/lib/health/health-checks";
import { paydaySuperDueDate } from "@/lib/payday-super";
import { reconcileBalanceAgainstPeriods } from "@/lib/xero/payg-reconciliation";

type Cycle = string | null;
const registered = (c: Cycle) => c === "monthly" || c === "quarterly";
type PayRun = { paymentDate: string | null; tax: number; super?: number };

/** PAYG withheld on pay runs whose payday falls inside [from, to]. */
export function paygWithheldInPeriod(runs: readonly PayRun[], from: string, to: string): number {
  return Math.round(runs.filter((r) => r.paymentDate && r.paymentDate >= from && r.paymentDate <= to).reduce((s, r) => s + (Number(r.tax) || 0), 0) * 100) / 100;
}

export function buildStoredForward(i: {
  today: string;
  gstCycle: Cycle;
  paygCycle: Cycle;
  /** Stored GST result for the running period (statementNet preferred). */
  gst: { statementNet?: number | null; gstOnSales?: number | null; gstOnPurchases?: number | null } | null;
  payRuns: readonly PayRun[] | null;
  payablesPayload: unknown | null;
  instalment: { amount: number; periodEnd: string } | null;
}): ForwardTax {
  const period = currentGstPeriod(i.gstCycle as any, i.today);
  const gst = !registered(i.gstCycle) ? 0 : i.gst ? (i.gst.statementNet ?? netGstAmount(i.gst as any)) : null;
  const paygOn = registered(i.paygCycle);
  const payg = paygOn && i.payRuns ? paygWithheldInPeriod(i.payRuns, period.from, period.asAt) : null;
  return forwardTax({
    bills: i.payablesPayload ? lodgedAtoBills(i.payablesPayload) : [],
    today: i.today,
    period,
    gst,
    payg,
    paygRegistered: paygOn,
    instalment: i.instalment ? { amount: i.instalment.amount, due: basDueDate("quarter", i.instalment.periodEnd) } : null,
  });
}

/** Super still to pay: the balance matched to whole paydays (newest first);
 *  due is 7 business days after the OLDEST unpaid payday. */
export function superDueNext(outstanding: number | null, runs: readonly PayRun[] | null): { amount: number; due: string | null } | null {
  if (outstanding === null || !(outstanding > 0.005)) return null;
  if (!runs) return { amount: outstanding, due: null };
  const byPayday = new Map<string, number>();
  for (const r of [...runs].sort((a, b) => (b.paymentDate ?? "").localeCompare(a.paymentDate ?? ""))) {
    if (!r.paymentDate) continue;
    byPayday.set(r.paymentDate, Math.round(((byPayday.get(r.paymentDate) ?? 0) + (Number(r.super) || 0)) * 100) / 100);
  }
  const recon = reconcileBalanceAgainstPeriods(outstanding, [...byPayday].map(([key, amount]) => ({ key, amount })));
  return { amount: outstanding, due: recon.oldest ? paydaySuperDueDate(recon.oldest) : null };
}

/** What is due next across lodged bills, building tax and super, by date. */
export function nextDueItems(fwd: ForwardTax, sup: { amount: number; due: string | null } | null) {
  const items: { label: string; amount: number; due: string | null; overdue: boolean }[] = [];
  for (const o of fwd.owing) items.push({ label: `Lodged ${o.reference || "activity statement"}`, amount: o.amount, due: o.due, overdue: o.overdue });
  if (fwd.building.total !== null && fwd.building.total > 0) items.push({ label: "Tax building now", amount: fwd.building.total, due: fwd.building.due, overdue: false });
  if (fwd.instalment) items.push({ label: "Income tax instalment", amount: fwd.instalment.amount, due: fwd.instalment.due, overdue: false });
  if (sup) items.push({ label: "Super", amount: sup.amount, due: sup.due, overdue: false });
  return items;
}
