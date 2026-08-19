// Server-only GST reconciliation engine — INDICATIVE by design.
//
// Xero's API does not expose the Activity Statement, so this reconstructs the
// GST control account movement from what the API does support: the balance
// sheet control balance, the tax on transactions dated in the period, and the
// transactions coded directly to the GST account (ATO payments and journals).
// It is a review aid, never a lodgement figure — the widget says so.

import type { Connection } from "./api.server";
import {
  bsValueFor,
  errText,
  fetchBalanceSheet,
  inPeriod,
  pageAll,
  periodFor,
  round2,
  xeroDateIso,
  xeroDateLiteral,
  type XeroAccount,
} from "./recon-shared.server";

export type GstTransaction = {
  date: string | null;
  source: string;
  reference: string | null;
  contact: string | null;
  amount: number; // positive = reduces the GST liability (e.g. paid to the ATO)
};

export type GstResult = {
  asAt: string;
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
};

const NEAR_ZERO = 0.005;

export async function computeGstReconciliation(
  conn: Connection,
  asAt: string,
): Promise<GstResult> {
  const { xeroGet } = await import("./api.server");
  const { from, to, priorEnd } = periodFor(asAt);
  const issues: string[] = [];
  let complete = true;

  // --- Control account balances -------------------------------------------
  let accounts: XeroAccount[] = [];
  let control: XeroAccount | null = null;
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;
  try {
    const accRes = await xeroGet<{ Accounts?: XeroAccount[] }>(conn, "Accounts", {});
    accounts = accRes.Accounts ?? [];
    control =
      accounts.find((a) => a.SystemAccount === "GST") ??
      accounts.find((a) => /^gst$/i.test(a.Name.trim())) ??
      accounts.find((a) => /gst/i.test(a.Name) && a.Class === "LIABILITY") ??
      null;
    if (!control) throw new Error("No GST control account was found in the chart of accounts.");
    const [closingBs, openingBs] = await Promise.all([
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

  return {
    asAt,
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
    ties: difference !== null && Math.abs(difference) < NEAR_ZERO,
    complete,
    issues,
  };
}
