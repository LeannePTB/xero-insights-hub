// Server-only Xero helpers for Loan Consolidation. Only import from
// `.functions.ts` handlers (via dynamic import). Uses the shared Xero API
// layer so token refresh, rate limiting and error handling are consistent
// with the rest of the app.

import { getConnectionByTenant, xeroGet } from "./api.server";

export type XeroAccount = {
  AccountID?: string;
  Code?: string;
  Name?: string;
  Class?: string;
  Type?: string;
  Status?: string;
};

export async function listAllAccounts(tenantId: string): Promise<XeroAccount[]> {
  const conn = await getConnectionByTenant(tenantId);
  const res = await xeroGet<{ Accounts?: XeroAccount[] }>(conn, "Accounts");
  return res.Accounts ?? [];
}

export async function getShortCode(tenantId: string): Promise<string | null> {
  try {
    const conn = await getConnectionByTenant(tenantId);
    const res = await xeroGet<{ Organisations?: { ShortCode?: string }[] }>(conn, "Organisations");
    return res.Organisations?.[0]?.ShortCode ?? null;
  } catch {
    return null;
  }
}

// ---- Balance Sheet account balances ---------------------------------------
// Loan reconciliation uses Balance Sheet instead of Trial Balance because
// the current Xero scopes include balance-sheet read access but not trial
// balance access. This keeps the same return shape so callers don't change.

type XeroReportCell = {
  Value?: string;
  Attributes?: Array<{ Value?: string; Id?: string }>;
};
type XeroReportRow = {
  RowType?: string;
  Cells?: XeroReportCell[];
  Rows?: XeroReportRow[];
  Title?: string;
};
type XeroReport = { Rows?: XeroReportRow[] };

export type XeroTrialBalanceBalances = {
  byAccountId: Map<string, number>;
  byAccountCode: Map<string, number>;
  byAccountName: Map<string, number>;
};

function normalizeReportText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-AU");
}

function parseReportAmount(value: string | undefined): number {
  const cleaned = (value ?? "").trim().replace(/[$,\s]/g, "");
  if (!cleaned || cleaned === "—" || cleaned === "-") return 0;
  const negative = cleaned.startsWith("(") && cleaned.endsWith(")");
  const parsed = Number.parseFloat(cleaned.replace(/[()]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

export async function fetchBalanceSheetBalances(opts: {
  tenantId: string;
  date: string; // YYYY-MM-DD
}): Promise<XeroTrialBalanceBalances> {
  const conn = await getConnectionByTenant(opts.tenantId);
  const json = await xeroGet<{ Reports?: XeroReport[] }>(conn, "Reports/BalanceSheet", {
    date: opts.date,
    standardLayout: "false",
    trackingOptionID1: "",
    trackingOptionID2: "",
  });
  const report = json.Reports?.[0];
  const out: XeroTrialBalanceBalances = {
    byAccountId: new Map(),
    byAccountCode: new Map(),
    byAccountName: new Map(),
  };
  if (!report?.Rows) return out;

  function sectionSign(title: string | undefined): number {
    const t = normalizeReportText(title ?? "");
    if (t.includes("liability") || t.includes("equity")) return -1;
    return 1; // assets and anything else treated as debit-balance positive
  }

  function extractAccountId(cell: XeroReportCell | undefined): string | undefined {
    const attributes = cell?.Attributes ?? [];
    return (
      attributes.find((attribute) => {
        const id = normalizeReportText(attribute.Id ?? "");
        return id === "account" || id === "accountid" || id === "account id";
      })?.Value ??
      attributes.find((attribute) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          attribute.Value ?? "",
        ),
      )?.Value
    );
  }

  function extractAccountCode(cell: XeroReportCell | undefined): string | undefined {
    const attributes = cell?.Attributes ?? [];
    return attributes.find((attribute) =>
      normalizeReportText(attribute.Id ?? "").includes("code"),
    )?.Value;
  }

  function walk(rows: XeroReportRow[], sign: number) {
    for (const r of rows) {
      if (r.Rows) {
        const childSign = r.RowType === "Section" ? sectionSign(r.Title) : sign;
        walk(r.Rows, childSign);
      }
      if (r.RowType === "Row" && r.Cells && r.Cells.length >= 2) {
        const accountCell = r.Cells[0];
        const accountId = extractAccountId(accountCell);
        const attributeAccountCode = extractAccountCode(accountCell);
        const reportAccountLabel = accountCell?.Value?.trim() ?? "";
        const trailingCodeMatch = reportAccountLabel.match(/\(([^()]+)\)\s*$/u);
        const parsedAccountCode = trailingCodeMatch?.[1]?.trim() ?? "";
        const accountCode = attributeAccountCode?.trim() || parsedAccountCode;
        const accountName = trailingCodeMatch
          ? reportAccountLabel.slice(0, trailingCodeMatch.index).trim()
          : reportAccountLabel;
        const balance = parseReportAmount(r.Cells[1]?.Value) * sign;

        if (accountId) out.byAccountId.set(accountId, balance);
        if (accountCode) out.byAccountCode.set(normalizeReportText(accountCode), balance);
        if (accountName) out.byAccountName.set(normalizeReportText(accountName), balance);
        if (reportAccountLabel) out.byAccountName.set(normalizeReportText(reportAccountLabel), balance);
      }
    }
  }
  walk(report.Rows, 1);
  return out;
}

// Kept as an alias for backward compatibility during the migration.
export const fetchTrialBalance = fetchBalanceSheetBalances;


// ---- Direct account transactions ------------------------------------------
export type XeroDirectAccountTransaction = {
  date: string | null;
  reference: string | null;
  description: string | null;
  contact: string | null;
  sourceType: string;
  sourceId: string;
  amount: number;
};

export type XeroDirectAccountTransactionResult = {
  transactions: XeroDirectAccountTransaction[];
  /** Sources that could not be read. Any entry means the ledger is incomplete. */
  sourceErrors: string[];
};

type DirectLine = {
  AccountID?: string;
  AccountCode?: string;
  Description?: string;
  LineAmount?: number;
  NetAmount?: number;
};

function directDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/\/Date\((-?\d+)/);
  if (m) {
    const d = new Date(parseInt(m[1], 10));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return raw.slice(0, 10) ?? null;
}

function directLineMatches(line: DirectLine, accountId: string, accountCode: string | null) {
  if (line.AccountID && line.AccountID === accountId) return true;
  return !!accountCode && (line.AccountCode ?? "").trim() === accountCode.trim();
}

export async function fetchDirectAccountTransactions(opts: {
  tenantId: string;
  accountId: string;
  accountCode: string | null;
  toDate: string;
}): Promise<XeroDirectAccountTransactionResult> {
  const conn = await getConnectionByTenant(opts.tenantId);

  async function fetchDirectPages<T>(endpoint: string, responseKey: string): Promise<T[]> {
    const all: T[] = [];
    for (let page = 1; page <= 1000; page++) {
      const body = await xeroGet<Record<string, unknown>>(conn, endpoint, {
        page: String(page),
        summaryOnly: "false",
      });
      const rows = Array.isArray(body[responseKey]) ? (body[responseKey] as T[]) : [];
      all.push(...rows);
      if (rows.length < 100) break;
    }
    return all;
  }

  type Invoice = {
    InvoiceID?: string;
    InvoiceNumber?: string;
    Reference?: string;
    Type?: string;
    Status?: string;
    Date?: string;
    Contact?: { Name?: string };
    LineItems?: DirectLine[];
  };
  type CreditNote = {
    CreditNoteID?: string;
    CreditNoteNumber?: string;
    Reference?: string;
    Type?: string;
    Status?: string;
    Date?: string;
    Contact?: { Name?: string };
    LineItems?: DirectLine[];
  };
  type BankTransaction = {
    BankTransactionID?: string;
    Reference?: string;
    Type?: string;
    Status?: string;
    Date?: string;
    Contact?: { Name?: string };
    LineItems?: DirectLine[];
  };
  type ManualJournal = {
    ManualJournalID?: string;
    Narration?: string;
    Status?: string;
    Date?: string;
    JournalLines?: DirectLine[];
  };

  const sourceLoads = await Promise.allSettled([
    fetchDirectPages<Invoice>("Invoices", "Invoices"),
    fetchDirectPages<CreditNote>("CreditNotes", "CreditNotes"),
    fetchDirectPages<BankTransaction>("BankTransactions", "BankTransactions"),
    fetchDirectPages<ManualJournal>("ManualJournals", "ManualJournals"),
  ]);
  const sourceNames = ["Invoices", "CreditNotes", "BankTransactions", "ManualJournals"];
  const sourceErrors = sourceLoads.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          `${sourceNames[index]}: ${
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          }`,
        ]
      : [],
  );
  const invoices = sourceLoads[0]?.status === "fulfilled" ? sourceLoads[0].value : [];
  const creditNotes = sourceLoads[1]?.status === "fulfilled" ? sourceLoads[1].value : [];
  const bankTransactions = sourceLoads[2]?.status === "fulfilled" ? sourceLoads[2].value : [];
  const manualJournals = sourceLoads[3]?.status === "fulfilled" ? sourceLoads[3].value : [];

  const output: XeroDirectAccountTransaction[] = [];
  const usable = (status: string | undefined, date: string | null) =>
    status !== "DELETED" && status !== "VOIDED" && (!date || date <= opts.toDate);
  const addLines = (input: {
    lines: DirectLine[] | undefined;
    sourceType: string;
    sourceId: string | undefined;
    date: string | null;
    reference: string | null;
    contact: string | null;
    sign: number;
  }) => {
    if (!input.sourceId) return;
    for (const line of input.lines ?? []) {
      if (!directLineMatches(line, opts.accountId, opts.accountCode)) continue;
      const rawAmount = line.NetAmount ?? line.LineAmount ?? 0;
      const amount = Math.round(rawAmount * input.sign * 100) / 100;
      if (Math.abs(amount) < 0.005) continue;
      output.push({
        date: input.date,
        reference: input.reference,
        description: line.Description?.trim() || null,
        contact: input.contact,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        amount,
      });
    }
  };

  for (const row of invoices) {
    const date = directDate(row.Date);
    if (!usable(row.Status, date)) continue;
    addLines({
      lines: row.LineItems,
      sourceType: row.Type?.toLocaleLowerCase("en-AU") ?? "invoice",
      sourceId: row.InvoiceID,
      date,
      reference: row.Reference ?? row.InvoiceNumber ?? null,
      contact: row.Contact?.Name ?? null,
      sign: row.Type === "ACCREC" ? -1 : 1,
    });
  }
  for (const row of creditNotes) {
    const date = directDate(row.Date);
    if (!usable(row.Status, date)) continue;
    addLines({
      lines: row.LineItems,
      sourceType: row.Type?.toLocaleLowerCase("en-AU") ?? "creditnote",
      sourceId: row.CreditNoteID,
      date,
      reference: row.Reference ?? row.CreditNoteNumber ?? null,
      contact: row.Contact?.Name ?? null,
      sign: row.Type === "ACCRECCREDIT" ? 1 : -1,
    });
  }
  for (const row of bankTransactions) {
    const date = directDate(row.Date);
    if (!usable(row.Status, date)) continue;
    addLines({
      lines: row.LineItems,
      sourceType: row.Type?.toLocaleLowerCase("en-AU") ?? "banktransaction",
      sourceId: row.BankTransactionID,
      date,
      reference: row.Reference ?? null,
      contact: row.Contact?.Name ?? null,
      sign: row.Type === "RECEIVE" ? -1 : 1,
    });
  }
  for (const row of manualJournals) {
    const date = directDate(row.Date);
    if (!usable(row.Status, date)) continue;
    addLines({
      lines: row.JournalLines,
      sourceType: "manualjournal",
      sourceId: row.ManualJournalID,
      date,
      reference: row.Narration ?? null,
      contact: null,
      sign: 1,
    });
  }
  return { transactions: output, sourceErrors };
}
