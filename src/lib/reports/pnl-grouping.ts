// Regroup a parsed Xero Profit and Loss by the ACCOUNT's own Type.
//
// Why: Xero's on-screen P&L layout groups accounts by their `Type`
// (DIRECTCOSTS, OVERHEADS, EXPENSE, …), but the Accounting API builds the
// report's sections from each account's *Report Code*. An account can be
// Direct Costs by Type and EXP by Report Code, so it shows under Cost of Sales
// in the organisation's own report and under operating expenses in ours.
// No request parameter changes that, so we regroup by Type ourselves.
//
// Nothing here is client-specific: the mapping is Xero's account Type only.
// Never add account names to this file.

export type XeroAccountRef = {
  accountId?: string | null;
  code?: string | null;
  name: string;
  type?: string | null;
};

export type GroupKind = "revenue" | "other-income" | "cost-of-sales" | "expenses" | "summary" | "other";

export const SECTION_INCOME = "Income";
export const SECTION_COST_OF_SALES = "Cost of Sales";
export const SECTION_OTHER_INCOME = "Other Income";
export const SECTION_OPERATING_EXPENSES = "Operating Expenses";

/** Account Type → report section. Xero's Type values, upper-cased, no spaces. */
export function sectionForAccountType(
  type: string | null | undefined,
): { title: string; kind: GroupKind } | null {
  const t = (type ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  switch (t) {
    case "REVENUE":
    case "SALES":
      return { title: SECTION_INCOME, kind: "revenue" };
    case "OTHERINCOME":
      return { title: SECTION_OTHER_INCOME, kind: "other-income" };
    case "DIRECTCOSTS":
಼      return { title: SECTION_COST_OF_SALES, kind: "cost-of-sales" };
    case "EXPENSE":
    case "OVERHEADS":
    case "DEPRECIATION":
      return { title: SECTION_OPERATING_EXPENSES, kind: "expenses" };
    default:
      return null;
  }
}

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Index accounts for lookup by AccountID, code and name. */
export function indexAccounts(accounts: XeroAccountRef[]) {
  const byId = new Map<string, XeroAccountRef>();
  const byCode = new Map<string, XeroAccountRef>();
  const byName = new Map<string, XeroAccountRef>();
  for (const a of accounts) {
    if (a.accountId) byId.set(a.accountId.toLowerCase(), a);
    if (a.code) byCode.set(String(a.code).trim().toLowerCase(), a);
    const n = normaliseName(a.name ?? "");
    if (n && !byName.has(n)) byName.set(n, a);
  }
  return { byId, byCode, byName };
}

export type AccountIndex = ReturnType<typeof indexAccounts>;

/**
 * Match one report row to an account. Order of preference:
 *   1. the AccountID Xero attaches to the row's cells (exact, unambiguous)
 *   2. a leading account code in the row label ("62220 Superannuation")
 *   3. the row label matched to an account name, case- and space-insensitive
 * Returns null when none of those hit.
 */
export function matchAccount(
  index: AccountIndex,
  row: { name: string; accountId?: string | null },
): XeroAccountRef | null {
  if (row.accountId) {
    const hit = index.byId.get(row.accountId.toLowerCase());
    if (hit) return hit;
  }
  const label = (row.name ?? "").trim();
  const codeMatch = label.match(/^([A-Za-z0-9.-]{2,10})\s*[-–—:]?\s+(.+)$/);
  if (codeMatch) {
    const hit = index.byCode.get(codeMatch[1].toLowerCase());
    if (hit) return hit;
  }
  return index.byName.get(normaliseName(label)) ?? null;
}
