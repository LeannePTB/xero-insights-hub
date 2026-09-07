// Build Xero deep links for finding entities. Xero's go.xero.com URLs require
// the shortCode to switch tenants. When we don't have it, fall back to a path
// that prompts the user to pick the org first.
//
// Paths here must match the ones Xero actually serves (the same ones used by
// src/lib/xero/loan-account-link.ts). Edit pages reject approved documents, so
// always link to the View page.
export function xeroDeepLink(entityType: string | null, entityId: string | null, shortCode?: string | null): string | null {
  if (!entityType || !entityId) return null;
  const id = encodeURIComponent(entityId);
  const path = (() => {
    switch (entityType) {
      case "Account": return `/GeneralLedger/AccountDetails.aspx?accID=${id}`;
      case "Invoice": return `/AccountsReceivable/View.aspx?InvoiceID=${id}`;
      case "Bill": return `/AccountsPayable/View.aspx?InvoiceID=${id}`;
      case "CreditNote": return `/AccountsReceivable/ViewCreditNote.aspx?creditNoteID=${id}`;
      case "Contact": return `/Contacts/View/${id}`;
      case "Payment": return `/Bank/ViewTransaction.aspx?paymentID=${id}`;
      default: return null;
    }
  })();
  if (!path) return null;
  if (shortCode) {
    return `https://go.xero.com/organisationlogin/default.aspx?shortcode=${encodeURIComponent(
      shortCode,
    )}&redirecturl=${encodeURIComponent(path)}`;
  }
  return `https://go.xero.com${path}`;
}
