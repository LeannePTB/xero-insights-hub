// Server-only helpers shared by the reconciliation engines (balance sheet,
// fixed assets, GST). Kept in one place so the three widgets parse Xero the
// same way and fail closed the same way.

import type { Connection } from "./api.server";

export const PAGE_SIZE = 100;
export const MAX_PAGES = 40;

export function xeroDateLiteral(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `DateTime(${y},${m},${d})`;
}

export function parseXeroDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  if (m) return new Date(parseInt(m[1], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function xeroDateIso(s?: string): string | null {
  const d = parseXeroDate(s);
  return d ? d.toISOString().slice(0, 10) : null;
}

export function onOrBefore(dateStr: string | undefined, asAt: string): boolean {
  const iso = xeroDateIso(dateStr);
  return iso !== null && iso <= asAt;
}

export function inPeriod(dateStr: string | undefined, from: string, to: string): boolean {
  const iso = xeroDateIso(dateStr);
  return iso !== null && iso >= from && iso <= to;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function errText(e: unknown) {
  return e instanceof Error ? e.message : String(e ?? "Unknown error");
}

/** First day of the month containing `asAt`, and the day before it. */
export function periodFor(asAt: string): { from: string; to: string; priorEnd: string } {
  const to = new Date(`${asAt}T00:00:00Z`);
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  const prior = new Date(from.getTime() - 86_400_000);
  return {
    from: from.toISOString().slice(0, 10),
    to: asAt,
    priorEnd: prior.toISOString().slice(0, 10),
  };
}

/** Page an endpoint until exhausted. Throws if the page cap is hit, so a
 *  truncated dataset can never be presented as a complete one. */
export async function pageAll<T>(
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

export type XeroAccount = {
  AccountID: string;
  Code?: string;
  Name: string;
  Type?: string;
  Class?: string;
  SystemAccount?: string;
  Status?: string;
};

export type BsLine = {
  accountId: string | null;
  name: string;
  value: number;
  section: string;
};

export type BsSummary = { section: string; name: string; value: number };

export type BalanceSheet = { lines: BsLine[]; summaries: BsSummary[] };

function cellAccountId(cells: any[]): string | null {
  for (const cell of cells) {
    const attrs = cell?.Attributes ?? [];
    const hit = (attrs as any[]).find((a) => a?.Id === "account" || a?.Id === "accountID");
    if (hit?.Value) return String(hit.Value);
  }
  return null;
}

/** Flatten a Balance Sheet report into account rows plus the section totals
 *  ("Total Assets", "Net Assets", …) that the checklist reports back. */
export function extractBalanceSheet(report: any): BalanceSheet {
  const lines: BsLine[] = [];
  const summaries: BsSummary[] = [];
  function walk(rows: any[], section: string) {
    for (const row of rows ?? []) {
      const title = String(row?.Title ?? "").trim();
      const nextSection = row?.RowType === "Section" && title ? title : section;
      if (Array.isArray(row?.Rows) && row.Rows.length) walk(row.Rows, nextSection);
      const cells = row?.Cells ?? [];
      if (cells.length < 2) continue;
      const name = String(cells[0]?.Value ?? "").trim();
      const raw = cells[1]?.Value;
      const value = raw === "" || raw === null || raw === undefined ? 0 : Number(raw) || 0;
      if (row?.RowType === "Row") {
        lines.push({ accountId: cellAccountId(cells), name, value, section });
      } else if (row?.RowType === "SummaryRow") {
        summaries.push({ section, name, value });
      }
    }
  }
  walk(report?.Rows ?? [], "");
  return { lines, summaries };
}

export async function fetchBalanceSheet(conn: Connection, date: string): Promise<BalanceSheet> {
  const { xeroGet } = await import("./api.server");
  const res = await xeroGet<{ Reports?: any[] }>(conn, "Reports/BalanceSheet", { date });
  const report = res.Reports?.[0];
  if (!report) throw new Error("Xero returned no Balance Sheet for this date.");
  return extractBalanceSheet(report);
}

export function summaryValue(bs: BalanceSheet, name: string): number | null {
  const hit = bs.summaries.find((s) => s.name.toLowerCase() === name.toLowerCase());
  return hit ? hit.value : null;
}

/** Balance for an account: prefer Xero's own account id attribute, fall back
 *  to the name. Returns null when the account is absent from the report. */
export function bsValueFor(bs: BalanceSheet, acc: { AccountID: string; Name: string }): number | null {
  const id = acc.AccountID.toLowerCase();
  const byId = bs.lines.find((l) => l.accountId && l.accountId.toLowerCase() === id);
  if (byId) return byId.value;
  const byName = bs.lines.find((l) => l.name.toLowerCase() === acc.Name.toLowerCase());
  return byName ? byName.value : null;
}
