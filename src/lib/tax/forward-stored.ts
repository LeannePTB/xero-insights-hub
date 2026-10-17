// Pure: the ONE forward-looking tax summary built from stored inputs. The
// Tax obligations card, Business Health's next-tax line, the Overview tax rule
// and column, and the monthly report all read these figures, so they agree.
import { currentGstPeriod, forwardTax, instalmentDueDate, netGstAmount, type ForwardTax } from "@/components/dashboard/tax-obligations";
import { dueDateForPeriodEnd, lastPeriodEnd, lodgedAtoBills, type NextTaxPayment, type TaxBalances } from "@/lib/health/health-checks";
import type { UnlodgedTax } from "@/components/dashboard/tax-obligations";
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
  instalmentFrequency?: "not_required" | "quarterly" | "annual" | null;
  /** Xero ledger balances (GST / PAYG accounts): today and at a period end. */
  ledger?: { current: TaxBalances | null; periodEnd: (date: string) => TaxBalances | null } | null;
}): ForwardTax {
  const period = currentGstPeriod(i.gstCycle as any, i.today);
  const gst = !registered(i.gstCycle) ? 0 : i.gst ? (i.gst.statementNet ?? netGstAmount(i.gst as any)) : null;
  const paygOn = registered(i.paygCycle);
  const bills = i.payablesPayload ? lodgedAtoBills(i.payablesPayload) : [];
  const unlodged = bills.length ? [] : unlodgedFromLedger(i.gstCycle, i.paygCycle, i.today, i.ledger ?? null);
  const paygRuns = paygOn && i.payRuns ? paygWithheldInPeriod(i.payRuns, currentGstPeriod(i.paygCycle as any, i.today).from, i.today) : null;
  // With no lodged statement the ledger is the source: PAYG accruing = balance now less the finished period's balance,
  // so finished + accruing always adds up to the PAYG account in Xero.
  const ledgerPayg = !bills.length && paygOn && i.ledger?.current
    ? Math.round(Math.max(0, i.ledger.current.payg - unlodged.filter((u) => u.kind === "payg").reduce((s, u) => s + u.amount, 0)) * 100) / 100
    : null;
  const legacyPayg = paygOn && i.payRuns ? paygWithheldInPeriod(i.payRuns, period.from, period.asAt) : null;
  const payg = ledgerPayg ?? legacyPayg;
  return forwardTax({
    bills,
    unlodged,
    paygCycle: i.paygCycle,
    paygPayRuns: ledgerPayg !== null && paygRuns !== null && Math.abs(paygRuns - ledgerPayg) >= 1 ? paygRuns : null,
    today: i.today,
    period,
    gst,
    payg,
    paygRegistered: paygOn,
    instalment: i.instalment ? { amount: i.instalment.amount, due: instalmentDueDate(i.instalmentFrequency ?? null, i.instalment.periodEnd) } : null,
    instalmentSetting: i.instalmentFrequency ?? "unset",
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
  for (const u of fwd.unlodged ?? []) items.push({ label: `${u.kind === "gst" ? "GST" : "PAYG withholding"} (not lodged in Xero)`, amount: u.amount, due: u.due, overdue: u.overdue });
  const b = fwd.building;
  if (b.gstDue && b.paygDue && b.gstDue !== b.paygDue) {
    if (b.payg && b.payg > 0) items.push({ label: "PAYG withholding currently accruing", amount: b.payg, due: b.paygDue, overdue: false });
    if (b.gst && b.gst > 0) items.push({ label: "GST currently accruing", amount: b.gst, due: b.gstDue, overdue: false });
  } else if (b.total !== null && b.total > 0) items.push({ label: "Tax currently accruing", amount: b.total, due: b.due, overdue: false });
  if (fwd.instalment) items.push({ label: "Income tax instalment", amount: fwd.instalment.amount, due: fwd.instalment.due, overdue: false });
  if (sup) items.push({ label: "Super", amount: sup.amount, due: sup.due, overdue: false });
  return items;
}

/**
 * Last finished lodgement period per tax with no lodged statement: the period-end
 * balance, capped at today's balance (any fall since is a payment). Missing
 * period-end balance → today's balance, flagged as an estimate.
 */
export function unlodgedFromLedger(gstCycle: Cycle, paygCycle: Cycle, today: string, ledger: { current: TaxBalances | null; periodEnd: (date: string) => TaxBalances | null } | null): UnlodgedTax[] {
  if (!ledger?.current) return [];
  const out: UnlodgedTax[] = [];
  for (const [kind, cycle] of [["gst", gstCycle], ["payg", paygCycle]] as const) {
    if (!registered(cycle)) continue;
    const to = lastPeriodEnd(cycle as any, today)!;
    const due = dueDateForPeriodEnd(cycle as any, to);
    const cur = Math.max(0, ledger.current[kind]);
    const at = ledger.periodEnd(to);
    const amount = Math.round((at ? Math.max(0, Math.min(at[kind], cur)) : cur) * 100) / 100;
    const [y, m] = to.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - (cycle === "quarterly" ? 3 : 1), 1)).toISOString().slice(0, 10);
    out.push({ kind, from, to, amount, due, overdue: due < today, estimate: !at });
  }
  return out.sort((a, b) => (a.due < b.due ? -1 : 1));
}

/** Business Health / Overview "next tax payment", read from the shared forward summary. */
export function nextTaxFromForward(fwd: ForwardTax | null | undefined): NextTaxPayment | null {
  if (!fwd) return null;
  const lodged = fwd.owing.length > 0;
  const items = lodged ? fwd.owing.map((o) => ({ due: o.due, amount: o.amount, estimate: false, to: null as string | null }))
    : (fwd.unlodged ?? []).map((u) => ({ due: u.due, amount: u.amount, estimate: u.estimate, to: u.to as string | null }));
  const b = fwd.building;
  const buildingDue = b.paygDue && b.gstDue ? (b.paygDue < b.gstDue ? b.paygDue : b.gstDue) : b.due;
  if (!items.length) {
    if (b.total === null) return null;
    return { due: buildingDue, amount: null, building: b.total, buildingDue, periodEnd: null, estimate: false, later: [], source: "balance_sheet" };
  }
  const first = items.map((x) => x.due).sort()[0]!;
  const now = items.filter((x) => x.due === first);
  const laterMap = new Map<string, number>();
  for (const x of items) if (x.due !== first) laterMap.set(x.due, (laterMap.get(x.due) ?? 0) + x.amount);
  return {
    due: first,
    amount: Math.round(now.reduce((s, x) => s + x.amount, 0) * 100) / 100,
    building: b.total ?? 0,
    buildingDue,
    periodEnd: now.find((x) => x.to)?.to ?? null,
    estimate: now.some((x) => x.estimate),
    later: [...laterMap].sort((a, c) => (a[0] < c[0] ? -1 : 1)).map(([due, amount]) => ({ due, amount: Math.round(amount * 100) / 100 })),
    source: lodged ? "lodged_bill" : "balance_sheet",
  };
}
