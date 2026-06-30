// Build Xero deep links for finding entities. Xero's go.xero.com URLs require
// the shortCode to switch tenants. When we don't have it, fall back to a path
// that prompts the user to pick the org first.
export function xeroDeepLink(entityType: string | null, entityId: string | null, shortCode?: string | null): string | null {
  if (!entityType || !entityId) return null;
  const base = shortCode ? `https://go.xero.com/organisationlogin/default.aspx?shortcode=${shortCode}&redirecturl=` : "https://go.xero.com";
  const path = (() => {
    switch (entityType) {
      case "Account": return `/Bank/BankAccounts.aspx`;
      case "Invoice": return `/AccountsReceivable/Edit.aspx?InvoiceID=${entityId}`;
      case "Bill": return `/AccountsPayable/Edit.aspx?InvoiceID=${entityId}`;
      case "CreditNote": return `/AccountsReceivable/ViewCreditNote.aspx?creditNoteID=${entityId}`;
      case "Contact": return `/Contacts/View/${entityId}`;
      case "Payment": return `/Bank/ViewPayment.aspx?paymentID=${entityId}`;
      default: return null;
    }
  })();
  if (!path) return null;
  return shortCode ? `${base}${encodeURIComponent(path)}` : `https://go.xero.com${path}`;
}
