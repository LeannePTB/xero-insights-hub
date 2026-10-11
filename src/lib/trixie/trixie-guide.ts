// Trixie's built-in product guide, pre-loaded every turn. Written from the
// current menus; the help library holds the step-by-step detail.

export const TRIXIE_STAFF_GUIDE = `Traction Advisory dashboards — quick guide
- Workspaces: the switcher at the top chooses All organisations, one organisation, or System Admin (platform staff only). Opening a client shows the client menu.
- Organisation menu: Overview (status of every client: In trouble / Needs attention / Watch / All clear, cash, net cash, Re-sync), Clients (list, Add from Xero, New client), Xero files (connected and unlinked files), Consolidations → Groups, Loan matrix, Loan groups, Loan accounts, People & access (team, Viewers, Business Owners), Settings → General, Card defaults, Subscription (read-only), Ownership, Support access.
- Client menu: Live Dashboard (cards such as cash, P&L, tax obligations, payables, receivables, break-even, health; Accrual/Cash toggle; Refresh figures), Monthly reports (prepare, preview, send), Cash flow scenario, Loans, Xero files → Payables, Receivables, Xero audit, Client settings → General, Cards & report branding, People, Xero connections, Tax & reporting (including Bank accounts & credit cards), Cost & cash commitments, Danger zone.
- Figures come from Xero, mostly from the overnight saved snapshot; Re-sync or Refresh figures pulls fresh data. Cash at bank excludes credit cards; Net cash is cash at bank less credit-card debt. The Protected money percentage is tax and super owed as a share of cash at bank (not net cash); over 100% means cash at bank does not cover it, and no cash at bank shows a dash.
- Login types: System Administrator (runs the platform; gives no client data by itself), Traction Advisory team (added as Staff to organisations Traction Advisory looks after), Organisation Owner, Staff, Viewer (always read-only; All clients including ones added later, or Selected clients — change it from the person's row on People), Business Owner (their own client only). Support access is a temporary read-only pass, not a login type.
- Cards offered to a client depend on what the organisation has bought or is trialling.`;

export const TRIXIE_VIEWER_GUIDE = `Traction Advisory dashboard — quick guide
- Live Dashboard shows your business's cards from Xero, such as cash, profit and loss, tax obligations, money owed to you and by you, break-even and business health.
- Figures mostly come from an overnight copy of your Xero data, so they may be a day behind Xero.
- Cash at bank excludes credit cards; Net cash is cash at bank less credit-card debt.
- Monthly reports holds the reports your adviser has sent you.
- For changes to cards, settings or access, contact your adviser at the organisation that manages your dashboard.`;

export const TRIXIE_PLATFORM_GUIDE = `System Admin — quick guide
- Platform: Organisations (list and each organisation's detail tabs), Platform staff, Platform branding, Trixie (on/off, model, knowledge, allowances, cost guard, usage alerts and spend).
- Monitoring: Security & Compliance, Xero monitoring.
- System Admin is metadata only: never client financial figures.`;

export function trixieGuide(audience: "platform" | "staff" | "viewer"): string {
  return audience === "platform" ? TRIXIE_PLATFORM_GUIDE : audience === "viewer" ? TRIXIE_VIEWER_GUIDE : TRIXIE_STAFF_GUIDE;
}
