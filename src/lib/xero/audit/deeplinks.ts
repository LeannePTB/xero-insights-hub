// Xero deep links, copied from Xero's own published link builders in their
// official MCP server (XeroAPI/xero-mcp-server, src/consts/deeplinks.ts).
// Do not invent paths here — if Xero does not publish one, we do not link.
//
// Every documented pattern except manual journals needs the organisation
// shortCode, so without one we return null and the button is not rendered.
// A missing button is better than a broken one.

function orgLogin(shortCode: string, redirectPath: string): string {
  return `https://go.xero.com/organisationlogin/default.aspx?shortcode=${shortCode}&redirecturl=${redirectPath}`;
}

export function xeroDeepLink(
  entityType: string | null,
  entityId: string | null,
  shortCode?: string | null,
): string | null {
  if (!entityType || !entityId) return null;
  const id = encodeURIComponent(entityId);

  // Manual journals are the one pattern Xero publishes without a shortCode.
  if (entityType === "ManualJournal") {
    return `https://go.xero.com/Journal/View.aspx?invoiceID=${id}`;
  }

  if (!shortCode) return null;
  const sc = shortCode;

  switch (entityType) {
    case "Invoice":
      return `https://go.xero.com/app/${encodeURIComponent(sc)}/invoicing/view/${id}`;
    case "Contact":
      return `https://go.xero.com/app/${encodeURIComponent(sc)}/contacts/contact/${id}`;
    case "Quote":
      return `https://go.xero.com/app/${encodeURIComponent(sc)}/quotes/view/${id}`;
    case "CreditNote":
      return orgLogin(sc, `/AccountsPayable/ViewCreditNote.aspx?creditNoteID=${id}`);
    case "Payment":
      return orgLogin(sc, `/Bank/ViewTransaction.aspx?bankTransactionID=${id}`);
    case "Bill":
      return orgLogin(sc, `/AccountsPayable/Edit.aspx?InvoiceID=${id}`);
    // Not in Xero's published list. Kept on the long-standing general ledger
    // account page, wrapped in the documented organisationlogin switcher.
    case "Account":
      return orgLogin(sc, `/GeneralLedger/AccountDetails.aspx?accID=${id}`);
    default:
      return null;
  }
}
