// Server-only AS-AT subledger reconstruction for receivables and payables.
//
// This is the single implementation of "what was outstanding at a past date".
// It was extracted from the Balance Sheet Reconciliation engine (which now
// calls it) so the reconciliation, the monthly report and anything else can
// never disagree.
//
// The rule: invoices dated on or before the period end, less payments dated on
// or before it, less credit note / overpayment / prepayment allocations dated
// on or before it. Unallocated credit documents still sit in the control
// account unless refunded in cash by the period end (refunds are carried in
// the document's own Payments array).
//
// `AmountDue` is the balance NOW and is never used.

import type { Connection } from "./api.server";
import { onOrBefore, pageAll, round2, xeroDateIso, xeroDateLiteral } from "./recon-shared.server";

export type AsAtEntry = {
  /** Contact the amount belongs to. */
  contact: string;
  /** Outstanding at the period end. Negative for unallocated credits. */
  amount: number;
  /** Date the ageing bucket is taken from (invoice due date, else its date). */
  dueDate: string | null;
  /** Document date. */
  date: string | null;
  kind: "invoice" | "credit";
  documentNumber: string | null;
};

export type AsAtLedger = {
  /** Control account balance at the period end — ties to the balance sheet. */
  balance: number;
  entries: AsAtEntry[];
  unreconciled: { label: string; detail: string; amount?: number }[];
};

type Allocation = { invoiceId: string; amount: number; date?: string };

function collectAllocations(docs: any[], asAt: string): Allocation[] {
  const out: Allocation[] = [];
  for (const doc of docs) {
    for (const a of doc?.Allocations ?? []) {
      const date = a?.Date ?? doc?.Date;
      if (!onOrBefore(date, asAt)) continue;
      const invoiceId = a?.Invoice?.InvoiceID;
      if (!invoiceId) continue;
      out.push({ invoiceId, amount: Number(a?.Amount) || 0, date });
    }
  }
  return out;
}

/**
 * Page a document endpoint with an as-at `where` clause. `FullyPaidOnDate` is
 * a documented filterable field; if Xero ever rejects it the error is raised
 * as-is rather than falling back to fetching the whole file.
 */
async function asAtFetch(
  conn: Connection,
  path: string,
  collection: string,
  where: string,
): Promise<any[]> {
  try {
    return await pageAll<any>(conn, path, collection, { where, order: "Date ASC" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/FullyPaidOnDate/i.test(msg)) {
      throw new Error(
        `${path}: Xero rejected the as-at filter on FullyPaidOnDate (${msg}). Refusing to fall back to fetching every document.`,
      );
    }
    throw e;
  }
}

/**
 * Reconstruct the receivables (ACCREC) or payables (ACCPAY) subledger as at
 * `asAt`, per document as well as in total. Pages until exhausted; `pageAll`
 * throws rather than silently truncating.
 */

export async function fetchAsAtLedger(
  conn: Connection,
  asAt: string,
  side: "ACCREC" | "ACCPAY",
): Promise<AsAtLedger> {
  const dt = xeroDateLiteral(asAt);
  const label = side === "ACCREC" ? "Accounts Receivable" : "Accounts Payable";

  // Only documents that were OPEN at the period end matter. Anything settled
  // before it nets to nil, so it is filtered out in Xero rather than fetched
  // and discarded in memory — a full file runs to thousands of invoices and
  // trips the paging cap.
  //
  // Open at the period end means: dated on or before it, and either still
  // AUTHORISED (includes part-paid, which carry no FullyPaidOnDate) or PAID
  // with FullyPaidOnDate after it.
  //
  // VOIDED and DELETED documents are excluded. A document voided after the
  // period end was arguably outstanding then, but in this file voids are
  // corrections of documents that should never have existed, and Xero's own
  // Balance Sheet excludes them too — including them would put the subledger
  // permanently out of step with the GL it is reconciled against.
  const openAtAsAt = `Date<=${dt}&&(Status=="AUTHORISED"||(Status=="PAID"&&FullyPaidOnDate>${dt}))`;

  const invoices = await asAtFetch(conn, "Invoices", "Invoices", `Type=="${side}"&&${openAtAsAt}`);
  const inSet = new Map<string, any>();
  let gross = 0;
  for (const inv of invoices) {
    inSet.set(inv.InvoiceID, inv);
    gross += Number(inv.Total) || 0;
  }

  // Credit notes are NOT narrowed to those still open at the period end. A
  // credit note fully allocated before the period end no longer has a balance
  // of its own, but its allocation still reduces an invoice that is in scope,
  // so it has to be read. Credit notes are a small population, so there is no
  // paging risk in taking them all.
  const creditNotes = await asAtFetch(
    conn,
    "CreditNotes",
    "CreditNotes",
    `Date<=${dt}&&Status!="DELETED"&&Status!="VOIDED"`,
  );

  const overpayments = await pageAll<any>(conn, "Overpayments", "Overpayments", {
    where: `Date<=${dt}&&Status!="DELETED"&&Status!="VOIDED"`,
    order: "Date ASC",
  });
  const prepayments = await pageAll<any>(conn, "Prepayments", "Prepayments", {
    where: `Date<=${dt}&&Status!="DELETED"&&Status!="VOIDED"`,
    order: "Date ASC",
  });

  const unreconciled: AsAtLedger["unreconciled"] = [];
  const settledByInvoice = new Map<string, number>();

  // Payments settling the invoices in scope.
  //
  // The Payments endpoint is NOT used: it is the whole cash history of the
  // file and runs to many thousands of records even for a small business, so
  // it trips the paging cap. Only payments against the in-scope invoices can
  // matter, and the Invoices response already carries each invoice's own
  // Payments array — so the payments are read from there, filtered to those
  // dated on or before the period end.
  let paid = 0;
  for (const inv of inSet.values()) {
    for (const p of inv?.Payments ?? []) {
      if (!onOrBefore(p?.Date, asAt)) continue;
      const amount = Number(p?.Amount) || 0;
      paid += amount;
      settledByInvoice.set(
        inv.InvoiceID,
        (settledByInvoice.get(inv.InvoiceID) ?? 0) + amount,
      );
    }
  }


  const sideCredits = creditNotes.filter((c) =>
    side === "ACCREC" ? c?.Type === "ACCRECCREDIT" : c?.Type === "ACCPAYCREDIT",
  );
  const sideOver = overpayments.filter((o) =>
    side === "ACCREC" ? o?.Type === "RECEIVE-OVERPAYMENT" : o?.Type === "SPEND-OVERPAYMENT",
  );
  const sidePre = prepayments.filter((o) =>
    side === "ACCREC" ? o?.Type === "RECEIVE-PREPAYMENT" : o?.Type === "SPEND-PREPAYMENT",
  );

  const creditDocs = [...sideCredits, ...sideOver, ...sidePre];

  let allocated = 0;
  let orphanAllocations = 0;
  for (const a of collectAllocations(creditDocs, asAt)) {
    if (inSet.has(a.invoiceId)) {
      allocated += a.amount;
      settledByInvoice.set(a.invoiceId, (settledByInvoice.get(a.invoiceId) ?? 0) + a.amount);
    } else orphanAllocations += a.amount;
  }
  if (round2(orphanAllocations) !== 0) {
    unreconciled.push({
      label: `${label}: allocations against out-of-scope invoices`,
      detail:
        "Credit note, overpayment or prepayment allocations point at invoices outside the period-end set. They are excluded from the subledger total.",
      amount: round2(orphanAllocations),
    });
  }

  // Unallocated credit documents still sit in the control account unless they
  // were refunded in cash on or before the period end.
  let unallocated = 0;
  const entries: AsAtEntry[] = [];
  for (const doc of creditDocs) {
    const total = Number(doc?.Total) || 0;
    const allocatedByAsAt = (doc?.Allocations ?? [])
      .filter((a: any) => onOrBefore(a?.Date ?? doc?.Date, asAt))
      .reduce((s: number, a: any) => s + (Number(a?.Amount) || 0), 0);
    const refundedByAsAt = (doc?.Payments ?? [])
      .filter((p: any) => onOrBefore(p?.Date ?? doc?.Date, asAt))
      .reduce((s: number, p: any) => s + (Number(p?.Amount) || 0), 0);
    const open = total - allocatedByAsAt - refundedByAsAt;
    unallocated += open;
    if (round2(open) !== 0) {
      entries.push({
        contact: doc?.Contact?.Name ?? "Unknown",
        // Unallocated credits reduce the control account balance.
        amount: round2(-open),
        dueDate: xeroDateIso(doc?.DueDate ?? doc?.DueDateString ?? doc?.Date ?? doc?.DateString),
        date: xeroDateIso(doc?.Date ?? doc?.DateString),
        kind: "credit",
        documentNumber: doc?.CreditNoteNumber ?? doc?.CreditNoteID ?? null,
      });
    }
  }

  for (const inv of inSet.values()) {
    const outstanding = (Number(inv.Total) || 0) - (settledByInvoice.get(inv.InvoiceID) ?? 0);
    if (round2(outstanding) === 0) continue;
    entries.push({
      contact: inv?.Contact?.Name ?? "Unknown",
      amount: round2(outstanding),
      dueDate: xeroDateIso(inv?.DueDate ?? inv?.DueDateString ?? inv?.Date ?? inv?.DateString),
      date: xeroDateIso(inv?.Date ?? inv?.DateString),
      kind: "invoice",
      documentNumber: inv?.InvoiceNumber ?? null,
    });
  }

  return { balance: round2(gross - paid - allocated - unallocated), entries, unreconciled };
}
