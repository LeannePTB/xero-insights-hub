// Server-only Balance Sheet reconciliation engine — the month-end checklist.
//
// Every balance sheet account is listed, each with one of three treatments:
//   reconciled  — a real subledger exists (AR, AP, bank accounts, fixed assets)
//   indicative  — GST, compared against a reconstructed movement, not exact
//   review      — no subledger exists (tax payable, loans, equity): eyeball it
//
// Subledgers are reconstructed AS AT the period end (never `AmountDue`, which
// is only ever "today").
//
// Fail closed: if any component cannot be fetched the affected rows are marked
// unavailable with a reason and the whole result is flagged incomplete. A
// reconciliation that reports "balanced" because it could not load credit
// notes is worse than one that reports nothing.

import type { Connection } from "./api.server";
import {
  bsValueFor,
  errText,
  extractBalanceSheet,
  onOrBefore,
  pageAll,
  round2,
  summaryValue,
  xeroDateLiteral,
  type BalanceSheet,
  type XeroAccount,
} from "./recon-shared.server";

export type ReconRowStatus = "balanced" | "variance" | "indicative" | "review" | "unavailable";

export type ReconRow = {
  key: string;
  label: string;
  section: string;
  kind: "receivables" | "payables" | "bank" | "fixed_assets" | "gst" | "review";
  treatment: "reconciled" | "indicative" | "review";
  group?: "loans";
  glBalance: number | null;
  subledgerBalance: number | null;
  variance: number | null;
  status: ReconRowStatus;
  reason?: string;
};

export type ReconResult = {
  asAt: string;
  rows: ReconRow[];
  unreconciled: { label: string; detail: string; amount?: number }[];
  totals: {
    totalAssets: number | null;
    totalCurrentLiabilities: number | null;
    netAssets: number | null;
  };
  complete: boolean;
  issues: string[];
};

type SideResult = {
  balance: number;
  unreconciled: { label: string; detail: string; amount?: number }[];
};

/** Delegates to the shared as-at reconstruction — the single implementation. */
async function subledgerSide(
  conn: Connection,
  asAt: string,
  side: "ACCREC" | "ACCPAY",
): Promise<SideResult> {
  const { fetchAsAtLedger } = await import("./asat-ledger.server");
  const ledger = await fetchAsAtLedger(conn, asAt, side);
  return { balance: ledger.balance, unreconciled: ledger.unreconciled };
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

const isLoanAccount = (name: string) => /\bloan\b|loan account/i.test(name);

// Xero emits some totals as ordinary rows. They are not accounts and must not
// be listed as something to review.
const SUMMARY_LABELS = ["net assets", "total equity", "total liabilities", "total assets"];
const isSummaryLine = (name: string) => {
  const n = name.trim().toLowerCase();
  return n.startsWith("total ") || SUMMARY_LABELS.includes(n);
};

function totalFrom(bs: BalanceSheet, name: string): number | null {
  const fromSummary = summaryValue(bs, name);
  if (fromSummary !== null) return fromSummary;
  const line = bs.lines.find((l) => l.name.trim().toLowerCase() === name.toLowerCase());
  return line ? line.value : null;
}

export async function computeBalanceSheetReconciliation(
  conn: Connection,
  asAt: string,
): Promise<ReconResult> {
  const { xeroGet } = await import("./api.server");
  const unreconciled: ReconResult["unreconciled"] = [];
  const issues: string[] = [];
  let complete = true;

  // --- Chart of accounts + balance sheet (GL side) -------------------------
  let accounts: XeroAccount[] = [];
  let bs: BalanceSheet = { lines: [], summaries: [] };
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
    bs = extractBalanceSheet(report);
  } catch (e) {
    glAvailable = false;
    glReason = errText(e);
    complete = false;
    issues.push(`Balance Sheet unavailable: ${glReason}`);
  }

  const accountsById = new Map(accounts.map((a) => [a.AccountID.toLowerCase(), a]));
  const accountsByName = new Map(accounts.map((a) => [a.Name.trim().toLowerCase(), a]));
  function accountForLine(line: { accountId: string | null; name: string }): XeroAccount | null {
    if (line.accountId) {
      const hit = accountsById.get(line.accountId.toLowerCase());
      if (hit) return hit;
    }
    return accountsByName.get(line.name.trim().toLowerCase()) ?? null;
  }

  // Rows keyed by the balance sheet line they explain. Anything not handled
  // below falls through to "review only".
  const handled = new Map<string, Omit<ReconRow, "section" | "glBalance">>();
  const lineKey = (l: { accountId: string | null; name: string }) =>
    (l.accountId ?? l.name).toLowerCase();

  const debtors = accounts.filter((a) => a.SystemAccount === "DEBTORS");
  const creditors = accounts.filter((a) => a.SystemAccount === "CREDITORS");

  // --- Receivables / payables ---------------------------------------------
  for (const side of ["ACCREC", "ACCPAY"] as const) {
    const isAR = side === "ACCREC";
    const label = isAR ? "Accounts Receivable" : "Accounts Payable";
    const control = isAR ? debtors[0] : creditors[0];
    const key = (control?.AccountID ?? label).toLowerCase();
    try {
      const sub = await subledgerSide(conn, asAt, side);
      unreconciled.push(...sub.unreconciled);
      handled.set(key, {
        key,
        label,
        kind: isAR ? "receivables" : "payables",
        treatment: "reconciled",
        subledgerBalance: round2(sub.balance),
        variance: null,
        status: "balanced",
      });
    } catch (e) {
      complete = false;
      const reason = errText(e);
      issues.push(`${label} subledger unavailable: ${reason}`);
      handled.set(key, {
        key,
        label,
        kind: isAR ? "receivables" : "payables",
        treatment: "reconciled",
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
  for (const acc of accounts.filter((a) => a.Type === "BANK")) {
    const hit =
      bankMap?.get(acc.AccountID.toLowerCase()) ??
      [...(bankMap?.values() ?? [])].find((v) => v.name.toLowerCase() === acc.Name.toLowerCase());
    handled.set(acc.AccountID.toLowerCase(), {
      key: acc.AccountID,
      label: acc.Name,
      kind: "bank",
      treatment: "reconciled",
      subledgerBalance: hit ? round2(hit.closing) : null,
      variance: null,
      status: hit ? "balanced" : "unavailable",
      reason: hit
        ? undefined
        : bankReason || "Xero's Bank Summary did not include this account for the period.",
    });
    if (!hit) complete = false;
  }

  // --- Fixed assets (asset register) ---------------------------------------
  const { fetchAssetRegister } = await import("./fixed-assets.server");
  const register = await fetchAssetRegister(conn, asAt);
  if (!register.available) {
    complete = false;
    issues.push(`Asset register unavailable: ${register.reason}`);
  }
  for (const acc of accounts.filter((a) => a.Type === "FIXED")) {
    const reg = register.byAccount.get(acc.AccountID.toLowerCase());
    const isAccum = /accum/i.test(acc.Name);
    const sub = register.available ? (isAccum ? -(reg?.accumulated ?? 0) : reg?.cost ?? 0) : null;
    handled.set(acc.AccountID.toLowerCase(), {
      key: acc.AccountID,
      label: acc.Name,
      kind: "fixed_assets",
      treatment: "reconciled",
      subledgerBalance: sub === null ? null : round2(sub),
      variance: null,
      status: sub === null ? "unavailable" : "balanced",
      reason: sub === null ? register.reason : undefined,
    });
  }

  // --- GST (indicative) ----------------------------------------------------
  try {
    const { computeGstReconciliation } = await import("./gst.server");
    const gst = await computeGstReconciliation(conn, asAt);
    const control =
      accounts.find((a) => a.SystemAccount === "GST") ??
      accounts.find((a) => a.Name === gst.controlAccountName);
    if (control) {
      handled.set(control.AccountID.toLowerCase(), {
        key: control.AccountID,
        label: control.Name,
        kind: "gst",
        treatment: "indicative",
        subledgerBalance: gst.expectedClosing,
        variance: null,
        status: "indicative",
        reason:
          "Reconstructed from transaction tax and GST account movements — indicative only, not a lodgement figure.",
      });
    }
    if (!gst.complete) issues.push(...gst.issues);
  } catch (e) {
    issues.push(`GST comparison unavailable: ${errText(e)}`);
  }

  // --- Assemble every balance sheet line -----------------------------------
  const rows: ReconRow[] = [];
  for (const line of bs.lines) {
    if (isSummaryLine(line.name)) continue;
    const acc = accountForLine(line);
    const key = acc ? acc.AccountID.toLowerCase() : lineKey(line);
    const base = handled.get(key) ?? handled.get(line.name.trim().toLowerCase());
    const gl = round2(line.value);
    if (base) {
      const variance =
        base.subledgerBalance === null ? null : round2(gl - base.subledgerBalance);
      const status: ReconRowStatus =
        base.status === "unavailable"
          ? "unavailable"
          : base.treatment === "indicative"
            ? "indicative"
            : variance === null
              ? "unavailable"
              : Math.abs(variance) < 0.005
                ? "balanced"
                : "variance";
      rows.push({
        ...base,
        section: line.section,
        glBalance: gl,
        variance,
        status,
        group: isLoanAccount(line.name) ? "loans" : undefined,
      });
    } else {
      rows.push({
        key,
        label: line.name,
        section: line.section,
        kind: "review",
        treatment: "review",
        group: isLoanAccount(line.name) ? "loans" : undefined,
        glBalance: gl,
        subledgerBalance: null,
        variance: null,
        status: "review",
        reason: "No subledger exists for this account — check the balance looks right.",
      });
    }
  }

  // Variances first — this tool exists to surface what is broken. Loan
  // accounts keep their own order; the widget groups them under one heading.
  const rank = (r: ReconRow) =>
    r.group === "loans"
      ? 5
      : r.status === "variance"
        ? 0
        : r.status === "unavailable"
          ? 1
          : r.status === "indicative"
            ? 2
            : r.treatment === "reconciled"
              ? 3
              : 4;
  rows.sort((a, b) => rank(a) - rank(b) || Math.abs(b.variance ?? 0) - Math.abs(a.variance ?? 0));

  return {
    asAt,
    rows,
    unreconciled,
    totals: {
      totalAssets: glAvailable ? totalFrom(bs, "Total Assets") : null,
      totalCurrentLiabilities: glAvailable ? totalFrom(bs, "Total Current Liabilities") : null,
      netAssets: glAvailable ? totalFrom(bs, "Net Assets") : null,
    },
    complete,
    issues,
  };
}
