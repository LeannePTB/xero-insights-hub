/**
 * Phase 6 — the vocabulary of the read audit trail.
 *
 * Client-safe (no server imports): it is a fixed list of short, stable strings
 * describing WHAT was read and WHERE it came from. It never holds a figure, an
 * account name, a contact name or anything else out of a client's data.
 */

/** Where the figures the person saw actually came from. */
export const READ_SOURCES = ["live", "snapshot", "cache", "report", "report_link"] as const;
export type ReadSource = (typeof READ_SOURCES)[number];

/**
 * Audit actions used for reads.
 *
 * `xero_data_read` is reused for every read of Xero figures, whether served
 * live, from a stored snapshot or from a cache — same data, same target (the
 * Xero file), only the source differs. A stored report or a public report link
 * gets its own action: the target is a report row, not a Xero connection, and
 * the report-link viewer has no signed-in actor at all, so reusing
 * `xero_data_read` there would misdescribe the event.
 */
export const READ_ACTION_XERO = "xero_data_read";
export const READ_ACTION_REPORT = "client_report_read";

/** Short stable keys. `report:monthly` style prefixes group a family. */
const PATH_KEYS: Record<string, string> = {
  "reports/profitandloss": "pnl",
  "reports/balancesheet": "balance_sheet",
  "reports/trialbalance": "trial_balance",
  "reports/agedreceivablesbycontact": "receivables",
  "reports/agedpayablesbycontact": "payables",
  "reports/banksummary": "bank_summary",
  "reports/budgetsummary": "budget",
  invoices: "invoices",
  creditnotes: "credit_notes",
  prepayments: "prepayments",
  overpayments: "overpayments",
  payments: "payments",
  accounts: "accounts",
  banktransactions: "bank_transactions",
  contacts: "contacts",
  organisations: "organisation",
  items: "items",
  currencies: "currencies",
  employees: "employees",
};

/**
 * Turn a Xero endpoint path into a stable read key. Unknown paths fall back to
 * a normalised form of the path itself — never the query string, which can
 * carry contact names or account codes from the client's data.
 */
export function readKeyForXeroPath(path: string): string {
  const clean = path.split("?")[0]!.replace(/^\/+|\/+$/g, "");
  const mapped = PATH_KEYS[clean.toLowerCase()];
  if (mapped) return mapped;
  const [head, ...rest] = clean.split("/");
  const prefix = head && /^(assets|payroll)$/i.test(head) ? `${head.toLowerCase()}:` : "";
  const tail = (rest.length ? rest.join("/") : clean).toLowerCase();
  return `${prefix}${PATH_KEYS[tail] ?? tail.replace(/[^a-z0-9]+/g, "_")}`;
}
