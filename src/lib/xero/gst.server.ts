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
 *  `unresolved` means no account could be identified as holding PAYG
 *  withholding — the total is then GST only, and says so. */
export type PaygSection =
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
  complete: boolean;
  issues: string[];
  payg: PaygSection;
  combinedAto: CombinedAtoSection | null;
  /** GST net plus PAYG withheld. Null when either side is unavailable. */
  estimatedPayable: number | null;
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
  const movements: GstTransaction[] = [];

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
  if (control) {
    const controlId = control.AccountID.toLowerCase();
    const controlCode = (control.Code ?? "").trim();
    const hits = (line: any) =>
      (line?.AccountID && String(line.AccountID).toLowerCase() === controlId) ||
      (!!controlCode && String(line?.AccountCode ?? "").trim() === controlCode);

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
        movements.push({ date: xeroDateIso(date), source, reference, contact, amount });
      }
    };

    for (const bt of bankTx) {
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
    for (const mj of manualJournals) {
      if (!inPeriod(mj?.Date, from, to)) continue;
      push(mj?.JournalLines, "Manual journal", mj?.Date, mj?.Narration ?? null, null, 1);
    }
    for (const inv of invoices) {
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
  }

  movements.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
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
    complete,
    issues,
  };
}
