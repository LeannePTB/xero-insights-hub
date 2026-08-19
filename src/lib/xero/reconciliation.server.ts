// Server-only Balance Sheet reconciliation engine.
//
// Compares each balance sheet control account against its supporting
// subledger, reconstructed AS AT the period end (never `AmountDue`, which is
// only ever "today").
//
// Fail closed: if any component cannot be fetched the affected rows are marked
// unavailable with a reason and the whole result is flagged incomplete. A
// reconciliation that reports "balanced" because it could not load credit
// notes is worse than one that reports nothing.

import type { Connection } from "./api.server";

export type ReconRow = {
  key: string;
  label: string;
  kind: "receivables" | "payables" | "bank";
  glBalance: number | null;
  subledgerBalance: number | null;
  variance: number | null;
  status: "balanced" | "variance" | "unavailable";
  reason?: string;
};

export type ReconResult = {
  asAt: string;
  rows: ReconRow[];
  unreconciled: { label: string; detail: string; amount?: number }[];
  complete: boolean;
  issues: string[];
};

const PAGE_SIZE = 100;
const MAX_PAGES = 40;

function xeroDateLiteral(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `DateTime(${y},${m},${d})`;
}

function parseXeroDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  if (m) return new Date(parseInt(m[1], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function onOrBefore(dateStr: string | undefined, asAt: string): boolean {
  const d = parseXeroDate(dateStr);
  if (!d) return false;
  return d.toISOString().slice(0, 10) <= asAt;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Page an endpoint until exhausted. Throws if the page cap is hit, so a
 *  truncated dataset can never be presented as a complete one. */
async function pageAll<T>(
  conn: Connection,
  path: string,
  collection: string,
  params: Record<string, string | undefined>,
): Promise<T[]> {
  const { xeroGet } = await import("./api.server");
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await xeroGet<Record<string, T[] | undefined>>(conn, path, {
      ...params,
      page: String(page),
    });
    const batch = res[collection] ?? [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) return out;
  }
  throw new Error(`${path}: too many records to page safely (over ${MAX_PAGES * PAGE_SIZE}).`);
}

type XeroAccount = {
  AccountID: string;
  Code?: string;
  Name: string;
  Type?: string;
  Class?: string;
  SystemAccount?: string;
  Status?: string;
};

type BsLine = { accountId: string | null; name: string; value: number };

/** Flatten a Balance Sheet report into account rows, keeping the account id
 *  Xero attaches to the first cell. */
function extractBalanceSheetLines(report: any): BsLine[] {
  const out: BsLine[] = [];
  function walk(rows: any[]) {
    for (const row of rows ?? []) {
      if (Array.isArray(row?.Rows) && row.Rows.length) walk(row.Rows);
      if (row?.RowType !== "Row") continue;
      const cells = row?.Cells ?? [];
      if (cells.length < 2) continue;
      const name = String(cells[0]?.Value ?? "").trim();
      const value = Number(cells[1]?.Value ?? 0) || 0;
      const attrs = cells[0]?.Attributes ?? cells[1]?.Attributes ?? [];
      const idAttr = (attrs as any[]).find((a) => a?.Id === "account" || a?.Id === "accountID");
      out.push({ accountId: idAttr?.Value ?? null, name, value });
    }
  }
  walk(report?.Rows ?? []);
  return out;
}

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

type SideResult = {
  balance: number;
  unreconciled: { label: string; detail: string; amount?: number }[];
};

async function subledgerSide(
  conn: Connection,
  asAt: string,
  side: "ACCREC" | "ACCPAY",
): Promise<SideResult> {
  const dt = xeroDateLiteral(asAt);
  const label = side === "ACCREC" ? "Accounts Receivable" : "Accounts Payable";

  const invoices = await pageAll<any>(conn, "Invoices", "Invoices", {
    where: `Type=="${side}"&&Date<=${dt}&&(Status=="AUTHORISED"||Status=="PAID")`,
    order: "Date ASC",
  });
  const inSet = new Map<string, number>();
  let gross = 0;
  for (const inv of invoices) {
    const total = Number(inv.Total) || 0;
    inSet.set(inv.InvoiceID, total);
    gross += total;
  }

  const payments = await pageAll<any>(conn, "Payments", "Payments", {
    where: `Date<=${dt}&&Status=="AUTHORISED"`,
    order: "Date ASC",
  });
  const creditNotes = await pageAll<any>(conn, "CreditNotes", "CreditNotes", {
    where: `Date<=${dt}&&Status!="DELETED"&&Status!="VOIDED"&&Status!="DRAFT"`,
    order: "Date ASC",
  });
  const overpayments = await pageAll<any>(conn, "Overpayments", "Overpayments", {
    where: `Date<=${dt}&&Status!="DELETED"&&Status!="VOIDED"`,
    order: "Date ASC",
  });
  const prepayments = await pageAll<any>(conn, "Prepayments", "Prepayments", {
    where: `Date<=${dt}&&Status!="DELETED"&&Status!="VOIDED"`,
    order: "Date ASC",
  });

  const unreconciled: SideResult["unreconciled"] = [];

  // Payments allocated to invoices in scope.
  let paid = 0;
  let orphanPayments = 0;
  for (const p of payments) {
    const invId = p?.Invoice?.InvoiceID;
    const invType = p?.Invoice?.Type;
    const amount = Number(p?.Amount) || 0;
    if (!invId) continue;
    if (invType && invType !== side) continue;
    if (inSet.has(invId)) paid += amount;
    else if (invType === side) orphanPayments += amount;
  }
  if (round2(orphanPayments) !== 0) {
    unreconciled.push({
      label: `${label}: payments against out-of-scope invoices`,
      detail:
        "Payments dated on or before the period end are allocated to invoices that are not authorised/paid, or are dated after the period end. They are excluded from the subledger total.",
      amount: round2(orphanPayments),
    });
  }

  // Credit note, overpayment and prepayment allocations.
  const sideCredits = creditNotes.filter((c) =>
    side === "ACCREC" ? c?.Type === "ACCRECCREDIT" : c?.Type === "ACCPAYCREDIT",
  );
  const sideOver = overpayments.filter((o) =>
    side === "ACCREC" ? o?.Type === "RECEIVE-OVERPAYMENT" : o?.Type === "SPEND-OVERPAYMENT",
  );
  const sidePre = prepayments.filter((o) =>
    side === "ACCREC" ? o?.Type === "RECEIVE-PREPAYMENT" : o?.Type === "SPEND-PREPAYMENT",
  );

  let allocated = 0;
  let orphanAllocations = 0;
  for (const a of collectAllocations([...sideCredits, ...sideOver, ...sidePre], asAt)) {
    if (inSet.has(a.invoiceId)) allocated += a.amount;
    else orphanAllocations += a.amount;
  }
  if (round2(orphanAllocations) !== 0) {
    unreconciled.push({
      label: `${label}: allocations against out-of-scope invoices`,
      detail:
        "Credit note, overpayment or prepayment allocations point at invoices outside the period-end set. They are excluded from the subledger total.",
      amount: round2(orphanAllocations),
    });
  }

  // Unallocated credit notes / overpayments / prepayments still sit in the
  // control account in Xero, so they belong in the subledger balance — unless
  // they were refunded in cash on or before the period end, which clears them
  // out of the control account without any invoice allocation. Refunds are
  // carried on the document's own Payments array.
  let unallocated = 0;
  for (const doc of [...sideCredits, ...sideOver, ...sidePre]) {
    const total = Number(doc?.Total) || 0;
    const allocatedByAsAt = (doc?.Allocations ?? [])
      .filter((a: any) => onOrBefore(a?.Date ?? doc?.Date, asAt))
      .reduce((s: number, a: any) => s + (Number(a?.Amount) || 0), 0);
    const refundedByAsAt = (doc?.Payments ?? [])
      .filter((p: any) => onOrBefore(p?.Date ?? doc?.Date, asAt))
      .reduce((s: number, p: any) => s + (Number(p?.Amount) || 0), 0);
    unallocated += total - allocatedByAsAt - refundedByAsAt;
  }



  const balance = round2(gross - paid - allocated - unallocated);
  return { balance, unreconciled };
}

async function bankClosingBalances(
  conn: Connection,
  asAt: string,
): Promise<Map<string, { name: string; closing: number }>> {
  const { xeroGet } = await import("./api.server");
  const to = new Date(`${asAt}T00:00:00Z`);
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  const res = await xeroGet<any>(conn, "Reports/BankSummary", {
    fromDate: from.toISOString().slice(0, 10),
    toDate: asAt,
  });
  const map = new Map<string, { name: string; closing: number }>();
  for (const r of res?.Reports ?? []) {
    for (const section of r?.Rows ?? []) {
      for (const row of section?.Rows ?? []) {
        if (row?.RowType !== "Row") continue;
        const cells = row?.Cells ?? [];
        if (cells.length < 5) continue;
        const name = String(cells[0]?.Value ?? "").trim();
        const closing = Number(cells[4]?.Value ?? 0) || 0;
        const attrs = cells[0]?.Attributes ?? [];
        const idAttr = (attrs as any[]).find((a) => a?.Id === "account" || a?.Id === "accountID");
        const key = (idAttr?.Value ?? name).toLowerCase();
        map.set(key, { name, closing });
      }
    }
  }
  return map;
}

function errText(e: unknown) {
  return e instanceof Error ? e.message : String(e ?? "Unknown error");
}

export async function computeBalanceSheetReconciliation(
  conn: Connection,
  asAt: string,
): Promise<ReconResult> {
  const { xeroGet } = await import("./api.server");
  const rows: ReconRow[] = [];
  const unreconciled: ReconResult["unreconciled"] = [];
  const issues: string[] = [];
  let complete = true;

  // --- Chart of accounts + balance sheet (GL side) -------------------------
  let accounts: XeroAccount[] = [];
  let bsLines: BsLine[] = [];
  let glAvailable = true;
  let glReason = "";
  try {
    const [accRes, bsRes] = await Promise.all([
      xeroGet<{ Accounts?: XeroAccount[] }>(conn, "Accounts", {}),
      xeroGet<{ Reports?: any[] }>(conn, "Reports/BalanceSheet", { date: asAt }),
    ]);
    accounts = accRes.Accounts ?? [];
    const report = bsRes.Reports?.[0];
    if (!report) throw new Error("Xero returned no Balance Sheet for this date.");
    bsLines = extractBalanceSheetLines(report);
  } catch (e) {
    glAvailable = false;
    glReason = errText(e);
    complete = false;
    issues.push(`Balance Sheet unavailable: ${glReason}`);
  }

  const byId = new Map(bsLines.filter((l) => l.accountId).map((l) => [l.accountId!.toLowerCase(), l]));
  function glFor(acc: XeroAccount): number | null {
    if (!glAvailable) return null;
    const hit = byId.get(acc.AccountID.toLowerCase());
    if (hit) return hit.value;
    const byName = bsLines.find((l) => l.name.toLowerCase() === acc.Name.toLowerCase());
    return byName ? byName.value : 0;
  }

  const debtors = accounts.filter((a) => a.SystemAccount === "DEBTORS");
  const creditors = accounts.filter((a) => a.SystemAccount === "CREDITORS");
  const banks = accounts.filter((a) => a.Type === "BANK");

  // --- Receivables / payables ---------------------------------------------
  for (const side of ["ACCREC", "ACCPAY"] as const) {
    const isAR = side === "ACCREC";
    const label = isAR ? "Accounts Receivable" : "Accounts Payable";
    const control = isAR ? debtors[0] : creditors[0];
    let gl: number | null = null;
    if (glAvailable) {
      gl = control
        ? glFor(control)
        : bsLines.find((l) => l.name.toLowerCase() === label.toLowerCase())?.value ?? null;
      // Payables sit as a liability (positive on the Balance Sheet).
    }
    try {
      const sub = await subledgerSide(conn, asAt, side);
      unreconciled.push(...sub.unreconciled);
      const subBalance = isAR ? sub.balance : sub.balance;
      if (gl === null) {
        rows.push({
          key: side,
          label,
          kind: isAR ? "receivables" : "payables",
          glBalance: null,
          subledgerBalance: round2(subBalance),
          variance: null,
          status: "unavailable",
          reason: glReason || "The Balance Sheet balance could not be loaded.",
        });
      } else {
        const variance = round2(gl - subBalance);
        rows.push({
          key: side,
          label,
          kind: isAR ? "receivables" : "payables",
          glBalance: round2(gl),
          subledgerBalance: round2(subBalance),
          variance,
          status: Math.abs(variance) < 0.005 ? "balanced" : "variance",
        });
      }
    } catch (e) {
      complete = false;
      const reason = errText(e);
      issues.push(`${label} subledger unavailable: ${reason}`);
      rows.push({
        key: side,
        label,
        kind: isAR ? "receivables" : "payables",
        glBalance: gl === null ? null : round2(gl),
        subledgerBalance: null,
        variance: null,
        status: "unavailable",
        reason,
      });
    }
  }

  // --- Bank accounts -------------------------------------------------------
  let bankMap: Map<string, { name: string; closing: number }> | null = null;
  let bankReason = "";
  try {
    bankMap = await bankClosingBalances(conn, asAt);
  } catch (e) {
    bankReason = errText(e);
    complete = false;
    issues.push(`Bank Summary unavailable: ${bankReason}`);
  }
  for (const acc of banks) {
    if (acc.Status && acc.Status !== "ACTIVE") continue;
    const gl = glFor(acc);
    const hit =
      bankMap?.get(acc.AccountID.toLowerCase()) ??
      [...(bankMap?.values() ?? [])].find((v) => v.name.toLowerCase() === acc.Name.toLowerCase());
    if (!bankMap || !hit || gl === null) {
      rows.push({
        key: acc.AccountID,
        label: acc.Name,
        kind: "bank",
        glBalance: gl === null ? null : round2(gl),
        subledgerBalance: hit ? round2(hit.closing) : null,
        variance: null,
        status: "unavailable",
        reason:
          bankReason ||
          glReason ||
          "Xero's Bank Summary did not include this account for the period.",
      });
      complete = false;
      continue;
    }
    const variance = round2(gl - hit.closing);
    rows.push({
      key: acc.AccountID,
      label: acc.Name,
      kind: "bank",
      glBalance: round2(gl),
      subledgerBalance: round2(hit.closing),
      variance,
      status: Math.abs(variance) < 0.005 ? "balanced" : "variance",
    });
  }

  // Variances first — this tool exists to surface what is broken.
  const rank = (r: ReconRow) => (r.status === "unavailable" ? 0 : r.status === "variance" ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || Math.abs(b.variance ?? 0) - Math.abs(a.variance ?? 0));

  return { asAt, rows, unreconciled, complete, issues };
}
