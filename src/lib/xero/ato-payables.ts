// Protected money that has already been LODGED and is still owing.
//
// Positive Traction's BAS workflow (and the workflow of most files they keep)
// is: lodge the activity statement, then raise a bill to the ATO in Accounts
// Payable whose lines are coded DIRECTLY to the statutory accounts — GST, PAYG
// withholding — at BAS Excluded. Payments are then applied to the bill, not to
// the liability accounts.
//
// The effect is that raising the bill MOVES the amount off the Balance Sheet
// statutory accounts and into Accounts Payable. So the true position is split:
//
//   Balance Sheet statutory accounts  = accrued, not yet lodged
//   Unpaid ATO bills in payables      = lodged, still owing
//
// Reading only the Balance Sheet therefore understates protected money, and it
// understates it most at the worst moment: the figure FALLS the instant a BAS
// is lodged.
//
// Rules this module obeys, without exception:
//
//   * Amounts come ONLY from line `AccountID` matches against the statutory
//     accounts that were already matched on the Balance Sheet. Contact names,
//     reference text and `TaxType = BASEXCLUDED` may trigger a refusal; they
//     may never contribute a figure.
//   * A part-paid bill is scaled by its unpaid proportion. Payments hit the
//     bill, not the line, so an unscaled line double-counts money already paid.
//   * Bills dated after the period end are not in the period.
//   * Where the workflow cannot be established, the figure is REFUSED. It is
//     never approximated and never rendered as zero.
//
// Pure: no imports other than types, so the snapshot rules engine can use it
// without pulling the Xero API client into its import graph.

import type { XeroAccountRef } from "./tax-lines";

export type AtoBillLine = {
  accountId?: string;
  lineAmount: number;
  taxType?: string;
};

export type AtoBill = {
  invoiceId?: string;
  contact: string;
  /** Document date. Bills dated after the period end are excluded. */
  date: string | null;
  /** Bill total, gross of payments. */
  total: number;
  /** Still unpaid. Drives the scaling of every line on the bill. */
  amountDue: number;
  lines: AtoBillLine[];
};

export type AtoBillContribution = {
  invoiceId?: string;
  contact: string;
  date: string | null;
  /** Sum of the bill's lines coded to statutory accounts, gross. */
  statutoryGross: number;
  /** `amountDue / total` — the unpaid proportion of the bill. */
  unpaidProportion: number;
  /** `statutoryGross * unpaidProportion`. What this bill contributes. */
  contribution: number;
};

/**
 * How the file records a lodged activity statement.
 *
 *  - `bill`      — ATO bills coded to the statutory accounts. Traceable.
 *  - `direct`    — no ATO bills at all; the Balance Sheet is already the whole
 *                  position. Reported as the Balance Sheet figure only.
 *  - `clearing`  — ATO bills coded to a clearing/suspense liability that
 *                  carries a contra balance. Refused: the contra handling is
 *                  deliberately not designed, and an approximation would be a
 *                  guess.
 *  - `untraceable` — ATO bills exist but reach no statutory account.
 *  - `unclear`   — evidence insufficient to establish any pattern.
 *  - `unavailable` — the payables list could not be read in full.
 */
export type AtoPayablePattern =
  | "bill"
  | "direct"
  | "clearing"
  | "untraceable"
  | "unclear"
  | "unavailable";

export type AtoPayablesAnalysis =
  | {
      status: "assessed";
      pattern: "bill";
      /** Lodged and still owing. Never negative. */
      lodgedOwing: number;
      bills: AtoBillContribution[];
    }
  | {
      /** No ATO bills in the file: nothing to add, and nothing refused. */
      status: "not_applicable";
      pattern: "direct";
    }
  | {
      status: "refused";
      pattern: Exclude<AtoPayablePattern, "bill" | "direct">;
      reason: string;
      /** Populated for `clearing`: the account the bills are coded to. */
      clearingAccountName?: string;
      /** ATO-named bills seen, for the audit finding's evidence. */
      atoBillCount?: number;
    };

// --- Refusal wording. Each suppresses the lodged and total lines entirely. ---

export const ATO_REFUSAL_UNCLEAR =
  "The way lodged activity statements are recorded in this file could not be established from the records available, so the amount already lodged and still owing to the ATO has not been included in this figure.";

export const ATO_REFUSAL_UNTRACEABLE =
  "There are unpaid bills to the ATO in this file, but they are not coded to the GST, PAYG withholding or superannuation accounts, so they could not be reconciled against the balances on the Balance Sheet. Only the Balance Sheet position is reported here.";

export const ATO_REFUSAL_UNAVAILABLE =
  "The list of unpaid supplier bills could not be read in full for this period, so any activity statement already lodged and still owing has not been included in this figure.";

// ---------------------------------------------------------------------------

/** Xero serialises dates as `/Date(1700000000000+0000)/` or as ISO. */
export function atoBillDateIso(v: string | null | undefined): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const net = v.match(/\/Date\((-?\d+)/);
  if (net) return new Date(Number(net[1])).toISOString().slice(0, 10);
  const t = new Date(v);
  return Number.isFinite(t.getTime()) ? t.toISOString().slice(0, 10) : null;
}

const ATO_NAME = /\b(a\.?t\.?o\.?|australian\s+tax(ation)?\s+office|aust\s+taxation\s+office|australian\s+taxation)\b/i;

/**
 * Contact names only ever cause a refusal — never a figure. The list of
 * spellings seen in real files is open-ended ("Australian Tax Office",
 * "Australian Taxation Office", "Australian Tax Office - Tax Returns"), which
 * is precisely why it cannot be trusted to add money.
 */
export function looksLikeAtoContact(name: string | null | undefined): boolean {
  return typeof name === "string" && ATO_NAME.test(name);
}

function isLiability(account: XeroAccountRef | undefined): boolean {
  return (account?.Class ?? "").toString().trim().toUpperCase() === "LIABILITY";
}

/** Read a bill's line items into the shape this module works in. */
export function toAtoBill(invoice: any, outstandingOverride?: number): AtoBill {
  const total = Number(invoice?.Total) || 0;
  const amountDue =
    outstandingOverride !== undefined ? outstandingOverride : Number(invoice?.AmountDue) || 0;
  return {
    invoiceId: typeof invoice?.InvoiceID === "string" ? invoice.InvoiceID : undefined,
    contact: invoice?.Contact?.Name ?? "Unknown",
    date: atoBillDateIso(invoice?.Date ?? invoice?.DateString),
    total,
    amountDue,
    lines: Array.isArray(invoice?.LineItems)
      ? invoice.LineItems.map((li: any) => ({
          accountId: typeof li?.AccountID === "string" ? li.AccountID : undefined,
          lineAmount: Number(li?.LineAmount) || 0,
          taxType: typeof li?.TaxType === "string" ? li.TaxType : undefined,
        }))
      : [],
  };
}

export function billsFromPayload(payload: any): AtoBill[] | null {
  const invoices = Array.isArray(payload) ? payload : payload?.Invoices;
  if (!Array.isArray(invoices)) return null;
  return invoices.map((i) => toAtoBill(i));
}

export type AtoPayablesInput = {
  bills: AtoBill[] | null;
  /** False when the payables pull was truncated. */
  complete: boolean;
  /** yyyy-mm-dd. Bills dated after this are not in the period. */
  periodEnd: string;
  /** Accounts backing the GST / PAYG / super lines matched on the Balance Sheet. */
  statutoryAccountIds: string[];
  accountsById: Map<string, XeroAccountRef>;
  /** Balance Sheet balance per account ID, used only to spot a contra. */
  balancesByAccountId: Map<string, number>;
};

/** A clearing account is a liability the ATO bills hit that carries a contra. */
const CLEARING_CONTRA_THRESHOLD = -0.01;

export function analyseAtoPayables(input: AtoPayablesInput): AtoPayablesAnalysis {
  if (!input.complete || input.bills === null) {
    return { status: "refused", pattern: "unavailable", reason: ATO_REFUSAL_UNAVAILABLE };
  }
  if (!input.statutoryAccountIds.length) {
    // Nothing on the Balance Sheet to reconcile against, so no split can be
    // asserted even if ATO bills exist.
    return { status: "refused", pattern: "unclear", reason: ATO_REFUSAL_UNCLEAR };
  }

  const statutory = new Set(input.statutoryAccountIds);
  const inPeriod = input.bills.filter((b) => {
    if (b.date && b.date > input.periodEnd) return false; // dated after period end
    return true;
  });

  const contributions: AtoBillContribution[] = [];
  let atoNamedBills = 0;
  const clearingAccounts = new Map<string, number>();

  for (const bill of inPeriod) {
    const statutoryGross = bill.lines
      .filter((l) => l.accountId && statutory.has(l.accountId))
      .reduce((s, l) => s + l.lineAmount, 0);

    const isAtoNamed = looksLikeAtoContact(bill.contact);
    if (isAtoNamed) atoNamedBills += 1;

    if (statutoryGross > 0) {
      // Payments settle the BILL, not the line. Without this scaling the
      // July BAS bill of $5,835 with $1,000 outstanding would count at $5,835.
      const unpaidProportion = bill.total > 0 ? bill.amountDue / bill.total : 0;
      const contribution = statutoryGross * unpaidProportion;
      if (contribution > 0) {
        contributions.push({
          invoiceId: bill.invoiceId,
          contact: bill.contact,
          date: bill.date,
          statutoryGross,
          unpaidProportion,
          contribution,
        });
      }
      continue;
    }

    // Clearing evidence: an ATO-named bill coded to a non-statutory liability
    // account that carries a contra (debit) balance on the Balance Sheet. The
    // contra is what proves the account is being used to relieve the statutory
    // accounts, rather than being an ordinary payable.
    if (!isAtoNamed || bill.amountDue <= 0) continue;
    for (const line of bill.lines) {
      if (!line.accountId || statutory.has(line.accountId)) continue;
      const account = input.accountsById.get(line.accountId);
      if (!isLiability(account)) continue;
      const balance = input.balancesByAccountId.get(line.accountId);
      if (balance !== undefined && balance < CLEARING_CONTRA_THRESHOLD) {
        clearingAccounts.set(line.accountId, balance);
      }
    }
  }

  // Clearing takes precedence over everything: an approximated figure for a
  // file that relieves its statutory accounts through a suspense account would
  // be a guess, and this build deliberately does not design that handling.
  if (clearingAccounts.size > 0) {
    const [accountId] = [...clearingAccounts.keys()];
    return {
      status: "refused",
      pattern: "clearing",
      reason: ATO_REFUSAL_UNTRACEABLE,
      clearingAccountName: input.accountsById.get(accountId)?.Name ?? "a clearing account",
      atoBillCount: atoNamedBills,
    };
  }

  if (contributions.length > 0) {
    const lodgedOwing = contributions.reduce((s, c) => s + c.contribution, 0);
    return { status: "assessed", pattern: "bill", lodgedOwing, bills: contributions };
  }

  // ATO bills exist but none reaches a statutory account, and no clearing
  // contra explains where the money went.
  const unpaidAtoBills = inPeriod.filter((b) => looksLikeAtoContact(b.contact) && b.amountDue > 0);
  if (unpaidAtoBills.length > 0) {
    return {
      status: "refused",
      pattern: "untraceable",
      reason: ATO_REFUSAL_UNTRACEABLE,
      atoBillCount: unpaidAtoBills.length,
    };
  }

  // No ATO bills at all. Consistent with payments coded straight to the
  // liability accounts: the Balance Sheet is already the whole position, and
  // no claim is made that anything lodged is outstanding.
  return { status: "not_applicable", pattern: "direct" };
}

/**
 * The three-part figure. `lodgedOwing` and `total` are null whenever the split
 * was refused — they are never rendered as zero.
 */
export type ProtectedMoneySplit = {
  accruing: number;
  lodgedOwing: number | null;
  total: number | null;
  pattern: AtoPayablePattern;
  refusal: string | null;
};

export function buildProtectedMoneySplit(
  accruing: number,
  analysis: AtoPayablesAnalysis,
): ProtectedMoneySplit {
  if (analysis.status === "assessed") {
    return {
      accruing,
      lodgedOwing: analysis.lodgedOwing,
      total: accruing + analysis.lodgedOwing,
      pattern: "bill",
      refusal: null,
    };
  }
  if (analysis.status === "not_applicable") {
    // Direct pattern: the Balance Sheet is the whole position. There is no
    // separate lodged amount to claim, so the total IS the accrual.
    return { accruing, lodgedOwing: null, total: accruing, pattern: "direct", refusal: null };
  }
  return {
    accruing,
    lodgedOwing: null,
    total: null,
    pattern: analysis.pattern,
    refusal: analysis.reason,
  };
}
