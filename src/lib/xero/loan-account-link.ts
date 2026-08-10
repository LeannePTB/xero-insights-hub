// Client-safe helpers for linking straight into Xero.

export function buildXeroAccountLink(
  shortCode: string | null | undefined,
  accountId: string | null | undefined,
): string | null {
  if (!accountId) return null;
  const inner = `/GeneralLedger/AccountDetails.aspx?accID=${encodeURIComponent(accountId)}`;
  return wrap(shortCode, inner);
}

function wrap(shortCode: string | null | undefined, inner: string): string {
  if (shortCode) {
    return `https://go.xero.com/organisationlogin/default.aspx?shortcode=${encodeURIComponent(
      shortCode,
    )}&redirecturl=${encodeURIComponent(inner)}`;
  }
  return `https://go.xero.com${inner}`;
}

/**
 * Link to an individual transaction when Xero gave us a source document ID,
 * otherwise fall back to the account's transaction list.
 */
export function buildXeroTransactionLink(opts: {
  shortCode: string | null | undefined;
  accountId: string | null | undefined;
  sourceType: string | null | undefined;
  sourceId: string | null | undefined;
}): string | null {
  const { shortCode, sourceType, sourceId } = opts;
  const type = (sourceType ?? "").toLowerCase();
  if (sourceId) {
    const id = encodeURIComponent(sourceId);
    if (type.includes("banktransaction") || type.includes("spend") || type.includes("receive")) {
      return wrap(shortCode, `/Bank/ViewTransaction.aspx?bankTransactionID=${id}`);
    }
    if (type.includes("manualjournal")) {
      return wrap(shortCode, `/Journal/View.aspx?manualJournalID=${id}`);
    }
    if (type.includes("accreccredit")) {
      return wrap(shortCode, `/AccountsReceivable/ViewCreditNote.aspx?creditNoteID=${id}`);
    }
    if (type.includes("creditnote") || type.includes("accpaycredit")) {
      return wrap(shortCode, `/AccountsPayable/ViewCreditNote.aspx?creditNoteID=${id}`);
    }
    if (type.includes("accpay") || type.includes("bill")) {
      return wrap(shortCode, `/AccountsPayable/View.aspx?InvoiceID=${id}`);
    }
    if (type.includes("accrec") || type.includes("invoice")) {
      return wrap(shortCode, `/AccountsReceivable/View.aspx?InvoiceID=${id}`);
    }
    if (type.includes("journal")) {
      return wrap(shortCode, `/Journal/View.aspx?journalID=${id}`);
    }
    return wrap(shortCode, `/AccountsPayable/View.aspx?InvoiceID=${id}`);
  }
  return buildXeroAccountLink(shortCode, opts.accountId ?? null);
}
