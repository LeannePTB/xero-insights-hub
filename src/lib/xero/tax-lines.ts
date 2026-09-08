// Pure helpers for reading tax-liability lines out of a Xero Balance Sheet
// payload, and for turning them into the "protected money" figure.
//
// This module deliberately has NO imports: it is shared by live server
// functions (`reports.functions.ts`) and by the snapshot rules engine
// (`@/lib/health/rules.server`), and the rules engine must never pull the
// Xero API client into its import graph.

/** "ato-combined" is one account carrying GST and PAYG withholding together:
 *  a single amount owed to the ATO that must never be split between them. */
export type TaxLineCategory = "gst" | "payg" | "super" | "other-tax" | "ato-combined";
export type ExtractionStatus = "assessed" | "absent" | "unrecognised" | "input_invalid";

export type TaxLine = {
  name: string;
  amount: number;
  category: TaxLineCategory;
  accountId?: string;
};

export type TaxLineExtraction =
  | { status: "assessed"; lines: TaxLine[]; unrecognised: string[] }
  | { status: "absent"; lines: []; unrecognised: [] }
  | { status: "unrecognised"; lines: []; unrecognised: string[] }
  | { status: "input_invalid"; lines: []; unrecognised: []; reason: string };

export type CashAtBankExtraction =
  | { status: "assessed"; total: number; accounts: { name: string; balance: number }[] }
  | { status: "absent"; total: 0; accounts: [] }
  | { status: "unrecognised"; total: 0; accounts: []; reason: string }
  | { status: "input_invalid"; total: 0; accounts: []; reason: string };


type Cell = {
  Value?: string;
  Attributes?: { Id?: string; Value?: string }[];
};

type Row = {
  RowType?: string;
  Title?: string;
  Rows?: Row[];
  Cells?: Cell[];
};

type BalanceSheetReport = {
  Rows?: Row[];
  ReportDate?: string;
  ReportTitles?: string[];
};

export type XeroAccountRef = {
  AccountID?: string;
  Name?: string;
  Code?: string;
  Class?: string;
  Status?: string;
  SystemAccount?: string;
  Type?: string;
};

export type BalanceSheetAnalysis =
  | {
      status: "assessed";
      report: BalanceSheetReport;
      taxLines: TaxLineExtraction;
      cashAtBank: CashAtBankExtraction;
    }
  | {
      status: "input_invalid";
      report: null;
      taxLines: Extract<TaxLineExtraction, { status: "input_invalid" }>;
      cashAtBank: Extract<CashAtBankExtraction, { status: "input_invalid" }>;
    };

export function parseTaxAmount(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.replace(/[, ]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function hasWord(input: string, pattern: string): boolean {
  return new RegExp(`\\b${pattern}\\b`, "i").test(input);
}

function hasPhrase(input: string, phrase: string): boolean {
  return new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "i").test(input);
}

function normaliseText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isActiveLiability(account: XeroAccountRef | undefined): boolean {
  if (!account) return false;
  return normaliseText(account.Class).toUpperCase() === "LIABILITY" && normaliseText(account.Status).toUpperCase() === "ACTIVE";
}

/** A per-client override of what an account holds. `none` means "this account
 *  is not statutory", and is as deliberate as any other value. */
export type StatutoryCategory = "gst" | "payg" | "super" | "none";

/**
 * Per-client overrides, keyed by the account name lower-cased and trimmed —
 * the same key `client_statutory_accounts` stores. An account may carry more
 * than one category (an ATO account used for GST and PAYG withholding
 * together), so the value is the set a person ticked. Build one with
 * `statutoryOverrideMap`.
 */
export type StatutoryOverrides = Map<string, StatutoryCategory[]>;

export function statutoryOverrideKey(name: string): string {
  return normaliseText(name).toLowerCase();
}

export function statutoryOverrideMap(
  rows: { account_name: string; category: StatutoryCategory }[] | null | undefined,
): StatutoryOverrides {
  const map: StatutoryOverrides = new Map();
  for (const row of rows ?? []) {
    const k = statutoryOverrideKey(row?.account_name ?? "");
    if (!k || !row?.category) continue;
    const existing = map.get(k);
    if (existing) {
      if (!existing.includes(row.category)) existing.push(row.category);
    } else {
      map.set(k, [row.category]);
    }
  }
  return map;
}

/**
 * What a stored override resolves to.
 *  - `null`          nobody has set this account; fall through to Xero and names
 *  - `"none"`        deliberately not statutory; settled, never "unrecognised"
 *  - a category      exactly one thing
 *  - `"ato-combined"` GST and PAYG withholding on one account; the balance is a
 *                     single amount owed to the ATO and is never apportioned
 *  - `"conflict"`    superannuation ticked alongside an ATO category. Super is
 *                     owed to employees' funds, not the ATO, so the balance
 *                     cannot honestly be presented as either. The panel does not
 *                     allow this combination; if one exists the line is reported
 *                     as unidentified rather than mislabelled.
 */
export type StatutoryOverrideResolution =
  | null
  | "none"
  | "conflict"
  | Exclude<TaxLineCategory, "other-tax">
  | "ato-combined";

export function resolveStatutoryOverride(
  name: string,
  overrides?: StatutoryOverrides,
): StatutoryOverrideResolution {
  const set = overrides?.get(statutoryOverrideKey(name));
  if (!set || set.length === 0) return null;
  if (set.includes("none")) return "none";
  const hasSuper = set.includes("super");
  const hasGst = set.includes("gst");
  const hasPayg = set.includes("payg");
  if (hasSuper && (hasGst || hasPayg)) return "conflict";
  if (hasSuper) return "super";
  if (hasGst && hasPayg) return "ato-combined";
  if (hasGst) return "gst";
  if (hasPayg) return "payg";
  return null;
}

/**
 * Classify a protected-money line. When account metadata is supplied, Xero's
 * authoritative fields are applied first: only ACTIVE LIABILITY accounts can be
 * classified, and SystemAccount=GST beats any name match.
 *
 * Resolution order, and it lives here rather than in any caller so the monthly
 * report and the audit rule can never diverge:
 *   1. the account must be an active liability (when metadata is supplied)
 *   2. the stored per-client override set, if one exists for this account name
 *   3. Xero's SystemAccount=GST
 *   4. name matching
 * A name match is only ever a fallback; it is never written back as an
 * override, so an account keeps following the name rules until a person
 * deliberately sets it.
 */
export function classifyTaxLine(
  name: string,
  account?: XeroAccountRef,
  overrides?: StatutoryOverrides,
): TaxLineCategory | null {
  if (account && !isActiveLiability(account)) return null;

  const override = resolveStatutoryOverride(name, overrides);
  if (override === "none" || override === "conflict") return null;
  if (override) return override;


  if (account && normaliseText(account.SystemAccount).toUpperCase() === "GST") return "gst";

  if (hasWord(name, "gst") || hasWord(name, "vat") || hasPhrase(name, "sales tax")) return "gst";
  if (hasWord(name, "payg") || hasWord(name, "paye") || hasWord(name, "withholding")) return "payg";
  if (hasWord(name, "super") || hasWord(name, "superannuation")) return "super";
  if (hasPhrase(name, "tax payable") || hasPhrase(name, "income tax") || hasWord(name, "bas"))
    return "other-tax";
  return null;
}


function looksStatutoryButUnclassified(name: string, account: XeroAccountRef | undefined): boolean {
  if (normaliseText(account?.SystemAccount).toUpperCase() === "GST") return true;
  return (
    hasWord(name, "ato") ||
    hasWord(name, "gst") ||
    hasWord(name, "payg") ||
    hasWord(name, "paye") ||
    hasWord(name, "withholding") ||
    hasWord(name, "super") ||
    hasWord(name, "superannuation") ||
    hasPhrase(name, "sales tax") ||
    hasPhrase(name, "tax payable") ||
    hasPhrase(name, "income tax") ||
    hasPhrase(name, "payroll liabilities") ||
    hasPhrase(name, "employee entitlements") ||
    hasWord(name, "bas")
  );
}

export function walkTaxRows(rows: Row[] | undefined, visit: (r: Row) => void) {
  if (!rows) return;
  for (const r of rows) {
    visit(r);
    if (r.Rows) walkTaxRows(r.Rows, visit);
  }
}

function accountIdFromCells(cells: Cell[] | undefined): string | undefined {
  for (const cell of cells ?? []) {
    const attrs = cell.Attributes;
    if (!Array.isArray(attrs)) continue;
    for (const a of attrs) {
      if (a?.Id === "account" && typeof a.Value === "string" && a.Value.trim()) return a.Value.trim();
    }
  }
  return undefined;
}

function normaliseBalanceSheetReport(input: any):
  | { status: "assessed"; report: BalanceSheetReport }
  | { status: "input_invalid"; reason: string } {
  const report = Array.isArray(input?.Reports) ? input.Reports[0] : input;
  if (!report || !Array.isArray(report.Rows)) {
    return {
      status: "input_invalid",
      reason: "Balance Sheet payload did not contain a report with Rows.",
    };
  }
  return { status: "assessed", report };
}

function normaliseAccounts(input: any):
  | { status: "assessed"; byId: Map<string, XeroAccountRef> }
  | { status: "input_invalid"; reason: string } {
  const accounts = Array.isArray(input) ? input : input?.Accounts;
  if (!Array.isArray(accounts)) {
    return { status: "input_invalid", reason: "Accounts payload did not contain an Accounts array." };
  }

  const byId = new Map<string, XeroAccountRef>();
  for (const account of accounts) {
    const id = normaliseText(account?.AccountID);
    if (id) byId.set(id, account);
  }
  return { status: "assessed", byId };
}

/** Accounts keyed by ID. Empty map when the payload is missing or malformed. */
export function accountRefsById(accountsInput: any): Map<string, XeroAccountRef> {
  const r = normaliseAccounts(accountsInput);
  return r.status === "assessed" ? r.byId : new Map();
}


function invalidTax(reason: string): Extract<TaxLineExtraction, { status: "input_invalid" }> {
  return { status: "input_invalid", lines: [], unrecognised: [], reason };
}

function invalidCash(reason: string): Extract<CashAtBankExtraction, { status: "input_invalid" }> {
  return { status: "input_invalid", total: 0, accounts: [], reason };
}

function extractTaxLinesFromReport(
  report: BalanceSheetReport,
  accountsById: Map<string, XeroAccountRef>,
  overrides?: StatutoryOverrides,
): TaxLineExtraction {
  const lines: TaxLine[] = [];
  const unrecognised: string[] = [];

  walkTaxRows(report.Rows, (r) => {
    if (r.RowType !== "Row" || !r.Cells || r.Cells.length < 2) return;
    const name = r.Cells[0]?.Value;
    if (!name) return;

    const accountId = accountIdFromCells(r.Cells);
    const account = accountId ? accountsById.get(accountId) : undefined;

    if (!account) {
      if (looksStatutoryButUnclassified(name, account)) unrecognised.push(name);
      return;
    }
    if (!isActiveLiability(account)) return;

    const category = classifyTaxLine(name, account, overrides);
    if (!category) {
      // An account a person has explicitly marked "none" is settled, not
      // unrecognised, however statutory its name looks.
      const resolution = resolveStatutoryOverride(name, overrides);
      // "none" is settled, however statutory the name looks. A conflicting
      // mapping (super alongside GST or PAYG) is the opposite: the balance is
      // statutory but cannot be attributed, so it is reported as unidentified
      // rather than folded into any total.
      if (resolution === "conflict") {
        unrecognised.push(name);
        return;
      }
      if (resolution !== "none" && looksStatutoryButUnclassified(name, account)) unrecognised.push(name);
      return;
    }

    const amount = parseTaxAmount(r.Cells[1]?.Value);
    lines.push({ name, amount, category, accountId });
  });

  if (lines.length > 0) return { status: "assessed", lines, unrecognised };
  if (unrecognised.length > 0) return { status: "unrecognised", lines: [], unrecognised };
  return { status: "absent", lines: [], unrecognised: [] };
}

function isActiveBankAccount(account: XeroAccountRef | undefined): boolean {
  if (!account) return false;
  return (
    normaliseText(account.Type).toUpperCase() === "BANK" &&
    normaliseText(account.Class).toUpperCase() === "ASSET" &&
    normaliseText(account.Status).toUpperCase() === "ACTIVE"
  );
}

/**
 * Cash at bank, resolved from Xero's own account metadata rather than the
 * layout of the Balance Sheet.
 *
 * The old implementation matched top-level sections titled "Bank", which is a
 * layout convention, not a fact: files that group their bank accounts under
 * "Current Assets" produced no figure at all, and the summary "Total Bank" row
 * was added to the sum alongside the accounts it summarised. Rows are now
 * matched on their account ID, so only real accounts are counted and total rows
 * (which carry no account attribute) can never be.
 *
 * When no bank row matches, the two causes are kept apart: a file with no
 * active bank account is `absent`, a file that has them but whose rows could
 * not be matched is `unrecognised`. An internal failure is never reported as
 * the client having no bank accounts.
 */
function extractCashAtBankFromReport(
  report: BalanceSheetReport,
  accountsById: Map<string, XeroAccountRef>,
): CashAtBankExtraction {
  const accounts: { name: string; balance: number }[] = [];
  let total = 0;

  walkTaxRows(report.Rows, (r) => {
    if (r.RowType !== "Row" || !r.Cells || r.Cells.length < 2) return;
    const name = r.Cells[0]?.Value;
    if (!name) return;
    const accountId = accountIdFromCells(r.Cells);
    if (!accountId) return;
    const account = accountsById.get(accountId);
    if (!isActiveBankAccount(account)) return;
    const amount = parseTaxAmount(r.Cells[1]?.Value);
    total += amount;
    accounts.push({ name, balance: amount });
  });

  if (accounts.length > 0) return { status: "assessed", total, accounts };

  const fileHasBankAccounts = [...accountsById.values()].some(isActiveBankAccount);
  if (fileHasBankAccounts) {
    return {
      status: "unrecognised",
      total: 0,
      accounts: [],
      reason:
        "The file has active bank accounts, but none of them could be matched to a line on the Balance Sheet, so cash at bank could not be read.",
    };
  }
  return { status: "absent", total: 0, accounts: [] };
}

/**
 * The single Balance Sheet normalisation boundary. It accepts either Xero's full
 * `{ Reports: [...] }` envelope or the inner report object and turns malformed
 * inputs into `input_invalid` instead of empty figures.
 */
export function analyseBalanceSheet(
  balanceSheetInput: any,
  accountsInput?: any,
  overrides?: StatutoryOverrides,
): BalanceSheetAnalysis {
  const reportResult = normaliseBalanceSheetReport(balanceSheetInput);
  if (reportResult.status === "input_invalid") {
    const reason = reportResult.reason;
    return {
      status: "input_invalid",
      report: null,
      taxLines: invalidTax(reason),
      cashAtBank: invalidCash(reason),
    };
  }

  const accountsResult = normaliseAccounts(accountsInput);
  const taxLines =
    accountsResult.status === "assessed"
      ? extractTaxLinesFromReport(reportResult.report, accountsResult.byId, overrides)
      : invalidTax(accountsResult.reason);
  const cashAtBank =
    accountsResult.status === "assessed"
      ? extractCashAtBankFromReport(reportResult.report, accountsResult.byId)
      : invalidCash(accountsResult.reason);

  return { status: "assessed", report: reportResult.report, taxLines, cashAtBank };
}

/**
 * Every Balance Sheet row balance, keyed by account ID. Total rows carry no
 * account attribute, so they can never be included. Used to spot a clearing
 * account carrying a contra balance; never used to produce a figure.
 */
export function balancesByAccountId(balanceSheetInput: any): Map<string, number> {
  const out = new Map<string, number>();
  const reportResult = normaliseBalanceSheetReport(balanceSheetInput);
  if (reportResult.status === "input_invalid") return out;
  walkTaxRows(reportResult.report.Rows, (r) => {
    if (r.RowType !== "Row" || !r.Cells || r.Cells.length < 2) return;
    const accountId = accountIdFromCells(r.Cells);
    if (!accountId) return;
    out.set(accountId, parseTaxAmount(r.Cells[1]?.Value));
  });
  return out;
}

/** Pull every tax-classified line out of a Balance Sheet payload. */
export function extractTaxLines(
  balanceSheetInput: any,
  accountsInput?: any,
  overrides?: StatutoryOverrides,
): TaxLineExtraction {
  return analyseBalanceSheet(balanceSheetInput, accountsInput, overrides).taxLines;
}


/**
 * Cash at bank from a Balance Sheet payload. The Accounts payload is required:
 * without it the bank accounts cannot be identified, and the result is
 * `input_invalid` rather than a silent zero.
 */
export function extractCashAtBank(balanceSheetInput: any, accountsInput?: any): CashAtBankExtraction {
  return analyseBalanceSheet(balanceSheetInput, accountsInput).cashAtBank;
}


export function taxLinesOrEmpty(result: TaxLineExtraction): TaxLine[] {
  return result.status === "assessed" ? result.lines : [];
}

export function taxLinesOrThrow(result: TaxLineExtraction): TaxLine[] {
  if (result.status === "assessed") return result.lines;
  if (result.status === "absent" || result.status === "unrecognised") return [];
  throw new Error(result.reason);
}

// ---------------------------------------------------------------------------
// Protected money – money the business holds but does not own.
// ---------------------------------------------------------------------------

export type ProtectedMoneyComponentKey = "gst" | "payg" | "super" | "ato-combined";

/** A component either resolves to an amount, or is explicitly unresolved
 *  because no Balance Sheet account matched its name patterns. An unresolved
 *  component is NOT the same as a resolved zero. */
export type ProtectedMoneyComponent =
  | {
      key: ProtectedMoneyComponentKey;
      label: string;
      status: "resolved";
      amount: number;
      accounts: { name: string; amount: number }[];
    }
  | {
      key: ProtectedMoneyComponentKey;
      label: string;
      status: "unresolved";
      amount: null;
      accounts: [];
      reason: string;
    };

export type ProtectedMoney = {
  asAtDate: string;
  /** Sum of the resolved components only. */
  total: number;
  /** True when every component resolved; false when any is unresolved. */
  complete: boolean;
  components: ProtectedMoneyComponent[];
  unresolved: ProtectedMoneyComponentKey[];
};

const PROTECTED_MONEY_LABELS: Record<ProtectedMoneyComponentKey, string> = {
  gst: "GST net position",
  payg: "PAYG withholding not yet remitted",
  super: "Superannuation accrued but unpaid",
  "ato-combined": "Owed to the ATO — GST and PAYG withholding together, not split",
};

/** Build the protected-money figure from already-extracted tax lines, so a
 *  caller that already has a Balance Sheet does not fetch it again.
 *
 *  Where a client codes GST and PAYG withholding to one account, that balance
 *  is a single amount owed to the ATO. There is nothing in the data to divide
 *  it by, so it is presented whole under its own heading and the GST and PAYG
 *  headings are omitted rather than reported as missing — the money is in the
 *  total, it simply is not split. Superannuation is owed to employees' funds,
 *  not the ATO, and is never part of this component.
 */
export function buildProtectedMoney(
  asAtDate: string,
  lines: { name: string; amount: number; category: TaxLineCategory }[],
): ProtectedMoney {
  const combined = lines.filter((l) => l.category === "ato-combined");
  const keys: ProtectedMoneyComponentKey[] = ["gst", "payg", "super"];
  const components: ProtectedMoneyComponent[] = [];

  for (const key of keys) {
    const matched = lines.filter((l) => l.category === key);
    const label = PROTECTED_MONEY_LABELS[key];
    if (!matched.length) {
      // Inside the combined figure, not missing from it.
      if (combined.length && (key === "gst" || key === "payg")) continue;
      components.push({
        key,
        label,
        status: "unresolved",
        amount: null,
        accounts: [],
        reason: `${label}: no account in the Balance Sheet matched this component, so the amount is unknown (this is not zero).`,
      });
      continue;
    }
    components.push({
      key,
      label,
      status: "resolved",
      amount: matched.reduce((s, l) => s + l.amount, 0),
      accounts: matched.map((l) => ({ name: l.name, amount: l.amount })),
    });
  }

  if (combined.length) {
    components.unshift({
      key: "ato-combined",
      label: PROTECTED_MONEY_LABELS["ato-combined"],
      status: "resolved",
      amount: combined.reduce((s, l) => s + l.amount, 0),
      accounts: combined.map((l) => ({ name: l.name, amount: l.amount })),
    });
  }

  const unresolved = components.filter((c) => c.status === "unresolved").map((c) => c.key);
  const total = components.reduce((s, c) => s + (c.status === "resolved" ? c.amount : 0), 0);
  return { asAtDate, total, complete: unresolved.length === 0, components, unresolved };
}

