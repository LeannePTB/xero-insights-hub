// Server-only drill-down engine for Loan Consolidation mismatches. Pulls the
// source transactions posted directly to both sides of a loan pair and builds
// its own ledger. A genuine inter-company loan pair mirrors: equal absolute
// amount, opposite sign. Anything that can't be paired is reported as the
// likely cause of the out-of-balance amount.

import type { XeroDirectAccountTransaction } from "./xero/loan-xero.server";

export type MismatchLine = {
  key: string;
  date: string | null;
  reference: string | null;
  description: string | null;
  contact: string | null;
  sourceType: string | null;
  sourceId: string | null;
  /** Debit positive, credit negative — same convention as the Trial Balance. */
  amount: number;
};

export type MismatchSideInfo = {
  tenantId: string;
  tenantName: string;
  accountId: string;
  accountCode: string | null;
  accountName: string;
  shortCode: string | null;
  balance: number | null;
  lineCount: number;
  error?: string;
};

export type MismatchDifference = {
  id: string;
  kind: "missing_counterparty" | "missing_this_file" | "amount" | "date";
  a: MismatchLine | null;
  b: MismatchLine | null;
  /** Amount this difference contributes to the net out-of-balance. */
  impact: number;
  note: string;
};

export type MismatchDetail = {
  asAt: string;
  net: number;
  account: MismatchSideInfo;
  counterparty: MismatchSideInfo;
  differences: MismatchDifference[];
  explained: number;
  unexplained: number;
};

function cents(n: number) {
  return Math.round(n * 100);
}

function normRef(s: string | null): string {
  return (s ?? "").trim().toLocaleLowerCase("en-AU").replace(/\s+/g, " ");
}

function dayDiff(a: string | null, b: string | null): number {
  if (!a || !b) return 9999;
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 9999;
  return Math.abs(Math.round((da - db) / 86400000));
}

function toMismatchLines(rows: XeroDirectAccountTransaction[]): MismatchLine[] {
  return rows.map((row, index) => ({ ...row, key: `l${index}` }));
}

async function loadSide(opts: {
  tenantId: string;
  accountId: string;
  accountCode: string | null;
  toDate: string;
}): Promise<MismatchLine[]> {
  const { fetchDirectAccountTransactions } = await import("./xero/loan-xero.server");
  const result = await fetchDirectAccountTransactions({
    tenantId: opts.tenantId,
    accountId: opts.accountId,
    accountCode: opts.accountCode,
    toDate: opts.toDate,
  });
  if (result.sourceErrors.length > 0) {
    throw new Error(
      `The transaction ledger is incomplete. ${result.sourceErrors.join(" | ")} Reconnect this Xero file in Client settings to update its transaction permissions.`,
    );
  }
  return toMismatchLines(result.transactions);
}

export async function runLoanMismatchDetail(input: {
  supabase: any; // supabaseAdmin — access is gated by the caller
  rowId: string;
  asAt: string;
}): Promise<MismatchDetail> {
  const { supabase, rowId, asAt } = input;

  const { data: row, error: rErr } = await supabase
    .from("loan_consolidation_accounts")
    .select(
      "id, tenant_id, account_id, account_code, account_name, counterparty_account_id, direction",
    )
    .eq("id", rowId)
    .maybeSingle();
  if (rErr) throw new Error(rErr.message);
  if (!row) throw new Error("Loan account row not found");
  if (!row.counterparty_account_id) throw new Error("This loan account has no counterparty set");

  const { data: cp, error: cErr } = await supabase
    .from("loan_consolidation_accounts")
    .select("id, tenant_id, account_id, account_code, account_name")
    .eq("id", row.counterparty_account_id)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!cp) throw new Error("Counterparty loan account not found");

  const { data: conns } = await supabase
    .from("xero_connections")
    .select("tenant_id, tenant_name")
    .in("tenant_id", [row.tenant_id, cp.tenant_id]);
  const connByTenant = new Map<string, any>();
  for (const c of (conns ?? []) as any[]) {
    if (!connByTenant.has(c.tenant_id)) connByTenant.set(c.tenant_id, c);
  }

  const { getShortCode } = await import("./xero/loan-xero.server");

  const [aRes, bRes] = await Promise.allSettled([
    loadSide({
      tenantId: row.tenant_id,
      accountId: row.account_id,
      accountCode: row.account_code,
      toDate: asAt,
    }),
    loadSide({
      tenantId: cp.tenant_id,
      accountId: cp.account_id,
      accountCode: cp.account_code,
      toDate: asAt,
    }),
  ]);

  const aLines = aRes.status === "fulfilled" ? aRes.value : [];
  const bLines = bRes.status === "fulfilled" ? bRes.value : [];

  const [aShort, bShort] = await Promise.all([
    getShortCode(row.tenant_id),
    getShortCode(cp.tenant_id),
  ]);

  const sideInfo = (
    src: { tenant_id: string; account_id: string; account_code: string | null; account_name: string },
    lines: MismatchLine[],
    err: string | undefined,
    shortCode: string | null,
  ): MismatchSideInfo => {
    const c = connByTenant.get(src.tenant_id);
    return {
      tenantId: src.tenant_id,
      tenantName: c?.tenant_name ?? "(unknown)",
      accountId: src.account_id,
      accountCode: src.account_code,
      accountName: src.account_name,
      shortCode,
      balance: err ? null : Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100,
      lineCount: lines.length,
      ...(err ? { error: err } : {}),
    };
  };

  const aErr =
    aRes.status === "rejected" ? (aRes.reason?.message ?? String(aRes.reason)) : undefined;
  const bErr =
    bRes.status === "rejected" ? (bRes.reason?.message ?? String(bRes.reason)) : undefined;

  // ---- pairing -------------------------------------------------------------
  const usedA = new Set<string>();
  const usedB = new Set<string>();
  const differences: MismatchDifference[] = [];

  const bByAmount = new Map<number, MismatchLine[]>();
  for (const b of bLines) {
    const k = -cents(b.amount);
    const list = bByAmount.get(k) ?? [];
    list.push(b);
    bByAmount.set(k, list);
  }

  const takeMatch = (a: MismatchLine, maxDays: number): MismatchLine | null => {
    const candidates = bByAmount.get(cents(a.amount)) ?? [];
    let best: MismatchLine | null = null;
    let bestDiff = Infinity;
    for (const b of candidates) {
      if (usedB.has(b.key)) continue;
      const d = dayDiff(a.date, b.date);
      if (d <= maxDays && d < bestDiff) {
        best = b;
        bestDiff = d;
      }
    }
    if (best) {
      usedA.add(a.key);
      usedB.add(best.key);
      if (bestDiff > 0 && maxDays > 0) {
        differences.push({
          id: `date-${a.key}-${best.key}`,
          kind: "date",
          a,
          b: best,
          impact: 0,
          note: `Same amount but posted ${bestDiff} day${bestDiff === 1 ? "" : "s"} apart — timing only, no effect on the balance at ${asAt}.`,
        });
      }
    }
    return best;
  };

  for (const pass of [0, 7, 99999]) {
    for (const a of aLines) {
      if (usedA.has(a.key)) continue;
      takeMatch(a, pass);
    }
  }

  const leftoverA = aLines.filter((l) => !usedA.has(l.key));
  const leftoverB = bLines.filter((l) => !usedB.has(l.key));
  for (const a of leftoverA) {
    const refA = normRef(a.reference) || normRef(a.description);
    const contactA = normRef(a.contact);
    const b = leftoverB.find((cand) => {
      if (usedB.has(cand.key)) return false;
      const refB = normRef(cand.reference) || normRef(cand.description);
      const contactB = normRef(cand.contact);
      const sameRef = !!refA && refA === refB;
      const sameContactDate = !!contactA && contactA === contactB && dayDiff(a.date, cand.date) <= 7;
      return sameRef || sameContactDate;
    });
    if (!b) continue;
    usedA.add(a.key);
    usedB.add(b.key);
    const impact = Math.round((a.amount + b.amount) * 100) / 100;
    differences.push({
      id: `amt-${a.key}-${b.key}`,
      kind: "amount",
      a,
      b,
      impact,
      note: `Matched on ${normRef(a.reference) && normRef(a.reference) === normRef(b.reference) ? "reference" : "contact and date"} but the amounts don't mirror — out by ${impact.toFixed(2)}.`,
    });
  }

  for (const a of aLines) {
    if (usedA.has(a.key)) continue;
    differences.push({
      id: `missB-${a.key}`,
      kind: "missing_counterparty",
      a,
      b: null,
      impact: a.amount,
      note: "No matching entry in the counterparty loan account — it looks like this transaction was never mirrored.",
    });
  }
  for (const b of bLines) {
    if (usedB.has(b.key)) continue;
    differences.push({
      id: `missA-${b.key}`,
      kind: "missing_this_file",
      a: null,
      b,
      impact: b.amount,
      note: "No matching entry in this file's loan account — it looks like this transaction was never mirrored.",
    });
  }

  differences.sort((x, y) => {
    const rank = (d: MismatchDifference) => (d.kind === "date" ? 1 : 0);
    if (rank(x) !== rank(y)) return rank(x) - rank(y);
    return Math.abs(y.impact) - Math.abs(x.impact);
  });

  const account = sideInfo(row, aLines, aErr, aShort);
  const counterparty = sideInfo(cp, bLines, bErr, bShort);
  const net = Math.round(((account.balance ?? 0) + (counterparty.balance ?? 0)) * 100) / 100;
  const explained = Math.round(differences.reduce((s, d) => s + d.impact, 0) * 100) / 100;

  return {
    asAt,
    net,
    account,
    counterparty,
    differences,
    explained,
    unexplained: Math.round((net - explained) * 100) / 100,
  };
}
