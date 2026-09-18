// Server-only activity-statement reconciliation engine — INDICATIVE by design.
//
// Xero's API does not expose the Activity Statement, so this reconstructs the
// GST control account movement from what the API does support: the balance
// sheet control balance, the tax on transactions dated in the period, and the
// transactions coded directly to the GST account (ATO payments and journals).
// PAYG withholding is rebuilt the same way, from the movement on whichever
// accounts the ONE resolver (`classifyTaxLine`) says hold it.
// It is a review aid, never a lodgement figure — the widget says so.

import type { Connection } from "./api.server";
import {
  bsValueFor,
  errText,
  fetchBalanceSheet,
  inPeriod,
  pageAll,
  rangeFor,
  round2,
  xeroDateIso,
  xeroDateLiteral,
  type BalanceSheet,
  type ReconWindow,
  type XeroAccount,
} from "./recon-shared.server";
import { classifyTaxLine, type StatutoryOverrides } from "./tax-lines";

export type GstTransaction = {
  date: string | null;
  source: string;
  reference: string | null;
  contact: string | null;
  amount: number; // positive = reduces the GST liability (e.g. paid to the ATO)
};

/** The PAYG withholding side of the activity statement.
 *  `not_applicable` means the client is set to "Does not withhold" on the
 *  client settings page, so PAYG was not looked for at all.
 *  `unresolved` means no account could be identified as holding PAYG
 *  withholding — the total is then GST only, and says so. */
export type PaygSection =
  | { status: "not_applicable" }
  | { status: "unresolved"; reason: string }
  | {
      status: "resolved";
      accountNames: string[];
      opening: number | null;
      closing: number | null;
      /** Amounts coded to the PAYG account(s) in the period — ATO payments and
       *  journals. Positive reduces the liability. */
      paidToAto: number;
      movements: GstTransaction[];
      /** closing − opening + paid. Derived from the account movement: payroll
       *  postings are not readable through the accounting API, so there is no
       *  independent second source to check this against. */
      withheld: number | null;
    };

/** One account carrying GST and PAYG withholding together. Its movement cannot
 *  be split between the two without guessing, so it is reported whole and kept
 *  OUT of the estimated total — part of it may already sit in the GST figure. */
export type CombinedAtoSection = {
  accountNames: string[];
  opening: number | null;
  closing: number | null;
  movement: number | null;
};

/**
 * PAYG withheld in the period, taken from the pay runs whose PAYDAY falls in
 * it. This is a period figure from payroll itself — not a balance movement —
 * so it belongs on the activity statement front page.
 */
export type PaygPayrollSection =
  | { status: "not_applicable" }
  | { status: "not_registered" }
  | { status: "setting_required" }
  | { status: "available"; withheld: number; payRuns: { paymentDate: string | null; tax: number }[] }
  | { status: "no_payroll" }
  | { status: "not_authorised"; reason: string }
  | { status: "unavailable"; reason: string };

/** Why the GST figures might not tie, as a machine code. */
export type GstTieReasonCode = "journals" | "rounding" | "timing";

export type GstResult = {
  asAt: string;
  window: ReconWindow;
  periodFrom: string;
  periodTo: string;
  controlAccountName: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  gstOnSales: number | null;
  gstOnPurchases: number | null;
  accountMovements: GstTransaction[];
  movementsTotal: number;
  expectedClosing: number | null;
  difference: number | null;
  ties: boolean;
  /** Plain-language reasons the figures might not tie. Empty when they tie. */
  tieReasons: string[];
  /** The same reasons as machine codes, so a client-facing summary can name
   *  the actual cause instead of assuming one. Same order as `tieReasons`. */
  tieReasonCodes: GstTieReasonCode[];
  complete: boolean;
  issues: string[];
  /** Balance-derived, preparer-only. The front page uses `paygPayroll`. */
  payg: PaygSection;
  paygPayroll: PaygPayrollSection;
  combinedAto: CombinedAtoSection | null;
  /** GST net plus PAYG withheld. Null when either side is unavailable. */
  estimatedPayable: number | null;
  /** Where each input came from and as at when. The GST side is read live from
   *  Xero; the pay-run side may be last night's saved copy. Never combine the
   *  two without stating both. */
  vintages: {
    /** When the live GST reports were read. */
    gstReadAt: string;
    /** True when the pay-run list came from the stored nightly copy. */
    payRunsFromSnapshot: boolean;
    /** The stored copy's own as-at date, when it came from one. */
    payRunsAsAt: string | null;
    /** When the stored copy was pulled. */
    payRunsFetchedAt: string | null;
    /** The stored copy's OWN completeness flag, never assumed. */
    payRunsComplete: boolean;
    /** False when the saved list stops before the period end, so a pay run
     *  inside the period may be missing from the estimate. */
    payRunsCoverPeriodEnd: boolean;
    /** The newest usable payday, so the gap is nameable. */
    latestPayRunDate: string | null;
    /** True when the two sides are of different vintages. */
    differs: boolean;
  };
};

const NEAR_ZERO = 0.005;

/** Amounts coded directly to any of `targets` by the documents already fetched
 *  for the period. Positive reduces the liability. */
function collectMovements(
  targets: XeroAccount[],
  docs: { invoices: any[]; bankTx: any[]; manualJournals: any[] },
  from: string,
  to: string,
): GstTransaction[] {
  if (targets.length === 0) return [];
  const ids = new Set(targets.map((a) => a.AccountID.toLowerCase()));
  const codes = new Set(targets.map((a) => (a.Code ?? "").trim()).filter(Boolean));
  const hits = (line: any) =>
    (line?.AccountID && ids.has(String(line.AccountID).toLowerCase())) ||
    codes.has(String(line?.AccountCode ?? "").trim());

  const out: GstTransaction[] = [];
  const push = (
    lines: any[] | undefined,
    source: string,
    date: string | undefined,
    reference: string | null,
    contact: string | null,
    sign: number,
  ) => {
    for (const line of lines ?? []) {
      if (!hits(line)) continue;
      const amount = round2((Number(line?.LineAmount ?? line?.NetAmount) || 0) * sign);
      if (Math.abs(amount) < NEAR_ZERO) continue;
      out.push({ date: xeroDateIso(date), source, reference, contact, amount });
    }
  };

  for (const bt of docs.bankTx) {
    if (!inPeriod(bt?.Date, from, to)) continue;
    const spend = String(bt?.Type ?? "").startsWith("SPEND");
    push(
      bt?.LineItems,
      spend ? "Spend money" : "Receive money",
      bt?.Date,
      bt?.Reference ?? null,
      bt?.Contact?.Name ?? null,
      spend ? 1 : -1,
    );
  }
  for (const mj of docs.manualJournals) {
    if (!inPeriod(mj?.Date, from, to)) continue;
    push(mj?.JournalLines, "Manual journal", mj?.Date, mj?.Narration ?? null, null, 1);
  }
  for (const inv of docs.invoices) {
    if (!inPeriod(inv?.Date, from, to)) continue;
    push(
      inv?.LineItems,
      inv?.Type === "ACCREC" ? "Sales invoice" : "Bill",
      inv?.Date,
      inv?.Reference ?? inv?.InvoiceNumber ?? null,
      inv?.Contact?.Name ?? null,
      inv?.Type === "ACCREC" ? -1 : 1,
    );
  }
  out.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return out;
}

/** Sum of an account set's balances on a balance sheet. Null when none of them
 *  appear, so "not on the report" stays distinct from a real zero. */
function bsTotalFor(bs: BalanceSheet | null, accounts: XeroAccount[]): number | null {
  if (!bs || accounts.length === 0) return null;
  let total = 0;
  let seen = false;
  for (const a of accounts) {
    const v = bsValueFor(bs, a);
    if (v === null) continue;
    seen = true;
    total += v;
  }
  return seen ? round2(total) : null;
}

export async function computeGstReconciliation(
  conn: Connection,
  asAt: string,
  window: ReconWindow = "month",
  overrides?: StatutoryOverrides,
  /** Caller's own session, used only to read the stored nightly pay-run
   *  snapshot. Omitted, the pay-run list is read live once. */
  supabase?: unknown,
  /** The client's own setting from the client settings page. `false` ("Does
   *  not withhold") means PAYG is not looked for at all: no account hunt, no
   *  pay-run read, no issue line, and the estimated total is GST alone. */
  withholdsPayg = true,
  clientId?: string | null,
): Promise<GstResult> {


  const { xeroGet } = await import("./api.server");
  const { from, to, priorEnd } = rangeFor(asAt, window);
  const issues: string[] = [];
  let complete = true;

  // --- Control account balances -------------------------------------------
  let accounts: XeroAccount[] = [];
  let control: XeroAccount | null = null;
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;
  // Held for the PAYG side, which reuses these two reports rather than
  // fetching its own — no extra Xero call.
  let closingBs: BalanceSheet | null = null;
  let openingBs: BalanceSheet | null = null;
  try {
    const accRes = await xeroGet<{ Accounts?: XeroAccount[] }>(conn, "Accounts", {});
    accounts = accRes.Accounts ?? [];
    control =
      accounts.find((a) => a.SystemAccount === "GST") ??
      accounts.find((a) => /^gst$/i.test(a.Name.trim())) ??
      accounts.find((a) => /gst/i.test(a.Name) && a.Class === "LIABILITY") ??
      null;
    if (!control) throw new Error("No GST control account was found in the chart of accounts.");
    [closingBs, openingBs] = await Promise.all([
      fetchBalanceSheet(conn, asAt),
      fetchBalanceSheet(conn, priorEnd),
    ]);
    closingBalance = bsValueFor(closingBs, control);
    openingBalance = bsValueFor(openingBs, control);
    if (closingBalance === null || openingBalance === null) {
      throw new Error("The GST control account did not appear on the Balance Sheet.");
    }
  } catch (e) {
    complete = false;
    issues.push(`GST control balance unavailable: ${errText(e)}`);
  }


  // --- Tax on transactions in the period -----------------------------------
  const dtFrom = xeroDateLiteral(from);
  const dtTo = xeroDateLiteral(to);
  let gstOnSales: number | null = null;
  let gstOnPurchases: number | null = null;
  let movements: GstTransaction[] = [];

  let invoices: any[] = [];
  let creditNotes: any[] = [];
  let bankTx: any[] = [];
  let manualJournals: any[] = [];
  // Manual journals need a scope Traction Advisory does not request, so they
  // are best effort: their absence is disclosed, never silently ignored.
  try {
    manualJournals = await pageAll<any>(conn, "ManualJournals", "ManualJournals", {
      where: `Date>=${dtFrom}&&Date<=${dtTo}&&Status=="POSTED"`,
      order: "Date ASC",
    });
  } catch {
    manualJournals = [];
    issues.push(
      "Manual journals could not be read for this organisation, so journals posted straight to the GST account are not included.",
    );
  }

  try {
    [invoices, creditNotes, bankTx] = await Promise.all([
      pageAll<any>(conn, "Invoices", "Invoices", {
        where: `Date>=${dtFrom}&&Date<=${dtTo}&&(Status=="AUTHORISED"||Status=="PAID")`,
        order: "Date ASC",
      }),
      pageAll<any>(conn, "CreditNotes", "CreditNotes", {
        where: `Date>=${dtFrom}&&Date<=${dtTo}&&Status!="DELETED"&&Status!="VOIDED"&&Status!="DRAFT"`,
        order: "Date ASC",
      }),
      pageAll<any>(conn, "BankTransactions", "BankTransactions", {
        where: `Date>=${dtFrom}&&Date<=${dtTo}&&Status!="DELETED"&&Status!="VOIDED"`,
        order: "Date ASC",
      }),
    ]);

    let sales = 0;
    let purchases = 0;
    for (const inv of invoices) {
      const tax = Number(inv?.TotalTax) || 0;
      if (inv?.Type === "ACCREC") sales += tax;
      else if (inv?.Type === "ACCPAY") purchases += tax;
    }
    for (const cn of creditNotes) {
      const tax = Number(cn?.TotalTax) || 0;
      if (cn?.Type === "ACCRECCREDIT") sales -= tax;
      else if (cn?.Type === "ACCPAYCREDIT") purchases -= tax;
    }
    for (const bt of bankTx) {
      const tax = Number(bt?.TotalTax) || 0;
      const type = String(bt?.Type ?? "");
      if (type.startsWith("RECEIVE")) sales += tax;
      else if (type.startsWith("SPEND")) purchases += tax;
    }
    gstOnSales = round2(sales);
    gstOnPurchases = round2(purchases);
  } catch (e) {
    complete = false;
    issues.push(`GST on transactions unavailable: ${errText(e)}`);
  }

  // --- Transactions coded directly to the GST account ----------------------
  const docs = { invoices, bankTx, manualJournals };
  if (control) movements = collectMovements([control], docs, from, to);
  const movementsTotal = round2(movements.reduce((s, m) => s + m.amount, 0));

  let expectedClosing: number | null = null;
  let difference: number | null = null;
  if (openingBalance !== null && gstOnSales !== null && gstOnPurchases !== null) {
    expectedClosing = round2(openingBalance + gstOnSales - gstOnPurchases - movementsTotal);
    if (closingBalance !== null) difference = round2(closingBalance - expectedClosing);
  }

  // A gap in the journals only matters if the movement fails to tie.
  const journalsMissing = issues.some((i) => i.startsWith("Manual journals"));
  const ties = difference !== null && Math.abs(difference) < NEAR_ZERO;
  if (journalsMissing && !ties) complete = false;

  // Why it might not tie. Each reason is derived from signals already computed
  // above — no extra Xero calls — so the card can explain the gap instead of
  // calling it "unexplained".
  const tieReasons: string[] = [];
  const tieReasonCodes: GstTieReasonCode[] = [];
  if (!ties && difference !== null) {
    if (journalsMissing) {
      tieReasons.push(
        "Manual journals posted straight to the GST account are not included — Xero does not let us read manual journals for this organisation, so any journal touching the GST account shows up as part of this difference.",
      );
      tieReasonCodes.push("journals");
    }
    if (
      gstOnSales !== null &&
      gstOnPurchases !== null &&
      Math.abs(gstOnSales - gstOnPurchases - (Math.floor(gstOnSales) - Math.floor(gstOnPurchases))) >
        0.004
    ) {
      tieReasons.push(
        "Rounding on the lodged form — the activity statement rounds each box down to whole dollars, while these figures keep the cents.",
      );
      tieReasonCodes.push("rounding");
    }
    const latePayments = movements.filter((m) => m.date && m.date > to).length;
    if (latePayments > 0) {
      tieReasons.push(
        "Timing — a payment to the ATO was dated after the end of this period, so it sits on the balance sheet but outside this period's figures.",
      );
      tieReasonCodes.push("timing");
    }
  }

  // --- PAYG withholding ----------------------------------------------------
  // Accounts come from the ONE resolver: the per-client statutory mapping,
  // with name matching as the fallback. No hardcoded names or codes, and no
  // second lookup.
  const controlId = control?.AccountID?.toLowerCase() ?? null;
  const paygAccounts: XeroAccount[] = [];
  const combinedAccounts: XeroAccount[] = [];
  for (const a of accounts) {
    if (String(a.Class ?? "").toUpperCase() !== "LIABILITY") continue;
    if (String((a as any).Status ?? "ACTIVE").toUpperCase() !== "ACTIVE") continue;
    if (controlId && a.AccountID.toLowerCase() === controlId) continue;
    const category = classifyTaxLine(a.Name ?? "", a as any, overrides);
    if (category === "payg") paygAccounts.push(a);
    else if (category === "ato-combined") combinedAccounts.push(a);
  }

  let payg: PaygSection;
  if (!withholdsPayg) {
    // The client says it does not withhold: honour it by not looking.
    payg = { status: "not_applicable" };
  } else if (paygAccounts.length === 0) {
    payg = {
      status: "unresolved",
      reason:
        combinedAccounts.length > 0
          ? "PAYG withholding is not held in an account of its own on this file — it shares an account with GST, so it cannot be separated out."
          : "No account on this file could be identified as holding PAYG withholding, so the total below is GST only.",
    };
  } else {
    const paygMovements = collectMovements(paygAccounts, docs, from, to);
    const paidToAto = round2(paygMovements.reduce((s, m) => s + m.amount, 0));
    const paygOpening = bsTotalFor(openingBs, paygAccounts);
    const paygClosing = bsTotalFor(closingBs, paygAccounts);
    // Payroll postings are not readable through the accounting API, so what
    // was withheld is derived from the account movement rather than counted
    // from payslips. There is no independent second source to check it
    // against — the card says so rather than implying a tie.
    const withheld =
      paygOpening !== null && paygClosing !== null ? round2(paygClosing - paygOpening + paidToAto) : null;
    if (withheld === null) {
      complete = false;
      issues.push("The PAYG withholding account did not appear on the Balance Sheet for both dates.");
    }
    payg = {
      status: "resolved",
      accountNames: paygAccounts.map((a) => a.Name),
      opening: paygOpening,
      closing: paygClosing,
      paidToAto,
      movements: paygMovements,
      withheld,
    };
  }

  const combinedAto: CombinedAtoSection | null =
    combinedAccounts.length === 0
      ? null
      : (() => {
          const opening = bsTotalFor(openingBs, combinedAccounts);
          const closing = bsTotalFor(closingBs, combinedAccounts);
          return {
            accountNames: combinedAccounts.map((a) => a.Name),
            opening,
            closing,
            movement: opening !== null && closing !== null ? round2(closing - opening) : null,
          };
        })();

  // --- PAYG withheld, from payroll -----------------------------------------
  // The pay runs whose PAYDAY falls in the period. One list call, snapshotted
  // nightly; a file without payroll withholds nothing, which is a real zero,
  // while a read we could not make stays null and says so.
  let paygPayroll: PaygPayrollSection;
  let payRunsFromSnapshot = false;
  let payRunsAsAt: string | null = null;
  let payRunsFetchedAt: string | null = null;
  let payRunsComplete = true;
  let payRunsCoverPeriodEnd = true;
  let latestPayRunDate: string | null = null;
  const gstReadAt = new Date().toISOString();
  if (!withholdsPayg) {
    // "Does not withhold": no pay-run read is made at all.
    paygPayroll = { status: "not_applicable" };
  } else {
    const { fetchPayRuns, loadPayRuns, payRunsInPeriod } = await import("./payroll.server");
    const runs = supabase
      ? await loadPayRuns({ supabase, tenantId: conn.tenant_id, clientId, conn })
      : await fetchPayRuns(conn, "registered");
    // The stored row's own provenance, read as-is. Never rebuilt.
    const prov = runs as {
      fromSnapshot?: boolean;
      fetchedAt?: string | null;
      snapshotSource?: import("./snapshot-source").SnapshotSource | null;
    };
    payRunsFromSnapshot = !!prov.fromSnapshot;
    payRunsAsAt = prov.snapshotSource?.asAt ?? null;
    payRunsFetchedAt = prov.snapshotSource?.fetchedAt ?? prov.fetchedAt ?? null;
    payRunsComplete = prov.snapshotSource
      ? prov.snapshotSource.complete
      : runs.status === "available"
        ? !runs.truncated
        : true;
    if (runs.status === "available") {
      // Compare like with like: a payday after the saved list's own as-at date
      // cannot be in that list, so the list cannot be treated as covering the
      // period end just because the period has closed.
      const usable = payRunsAsAt
        ? runs.payRuns.filter((r) => !!r.paymentDate && r.paymentDate <= payRunsAsAt!)
        : runs.payRuns;
      latestPayRunDate = usable.reduce<string | null>(
        (max, r) => (r.paymentDate && (!max || r.paymentDate > max) ? r.paymentDate : max),
        null,
      );
      payRunsCoverPeriodEnd = !payRunsAsAt || payRunsAsAt >= to;
      const inPeriodRuns = payRunsInPeriod(usable, from, to);
      paygPayroll = {
        status: "available",
        withheld: round2(inPeriodRuns.reduce((s, r) => s + r.tax, 0)),
        payRuns: inPeriodRuns.map((r) => ({ paymentDate: r.paymentDate, tax: round2(r.tax) })),
      };
      // An estimate is incomplete when the saved list stops before the period
      // ends OR was a partial pull — not only when a read failed.
      if (!payRunsCoverPeriodEnd) {
        complete = false;
        issues.push(
          `Pay runs are only saved as at ${payRunsAsAt}, which is before this period ends on ${to}. Any pay run paid after that date is not in the PAYG figure below.`,
        );
      }
      if (!payRunsComplete) {
        complete = false;
        issues.push(
          "The saved pay-run list was a partial pull (it stops at the read limit), so an older pay run inside this period may be missing from the PAYG figure below.",
        );
      }
    } else {
      paygPayroll = runs;
      if (runs.status !== "no_payroll") complete = false;
    }
  }

  const gstNet =
    gstOnSales !== null && gstOnPurchases !== null ? round2(gstOnSales - gstOnPurchases) : null;
  const paygWithheldForTotal =
    paygPayroll.status === "available"
      ? paygPayroll.withheld
      : paygPayroll.status === "no_payroll" || paygPayroll.status === "not_applicable" || paygPayroll.status === "not_registered"
        ? 0
        : null;
  const estimatedPayable =
    gstNet !== null && paygWithheldForTotal !== null ? round2(gstNet + paygWithheldForTotal) : null;



  return {
    asAt,
    window,
    periodFrom: from,
    periodTo: to,
    controlAccountName: control?.Name ?? null,
    openingBalance,
    closingBalance,
    gstOnSales,
    gstOnPurchases,
    accountMovements: movements,
    movementsTotal,
    expectedClosing,
    difference,
    ties,
    tieReasons,
    tieReasonCodes,
    complete,
    issues,
    payg,
    paygPayroll,
    combinedAto,
    estimatedPayable,
    vintages: {
      gstReadAt,
      payRunsFromSnapshot,
      payRunsAsAt,
      payRunsFetchedAt,
      payRunsComplete,
      payRunsCoverPeriodEnd,
      latestPayRunDate,
      differs: payRunsFromSnapshot && (!payRunsCoverPeriodEnd || !payRunsComplete || !!payRunsAsAt),
    },
  };

}
