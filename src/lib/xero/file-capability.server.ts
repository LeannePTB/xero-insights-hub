// What a Xero file can meaningfully support, derived at READ TIME from the
// snapshots the daily refresh already stores. Zero Xero calls, zero stored
// state, no database object.
//
// Why read-time and not stored: a chart of accounts changes without warning. A
// stored profile would need its own invalidation path and a table to live in;
// deriving from `xero_snapshots` is self-healing and costs a handful of
// indexed selects that are memoised for the life of one request.
//
// Access: every read goes through `context.supabase`, so RLS on
// `xero_snapshots` applies as the caller. A tenantId is a FILTER, never a
// GRANT — the caller checks access before reaching this module.
//
// FAIL OPEN, deliberately. This module decides whether to HIDE a card, not
// whether a user may see data. An unreadable or missing snapshot yields
// `unknown`, and `unknown` always SHOWS the card. Hiding a card a user is
// entitled to because a snapshot has not landed yet would be a worse failure
// than showing an honest empty one.

import { classifyTaxLine } from "./tax-lines";
import { readSnapshot } from "./snapshot-read.server";
import { memoiseXeroGet } from "./request-memo.server";

/**
 * Three states, never a bare boolean. `unknown` is a real answer: it means the
 * evidence does not separate "this file cannot do it" from "nothing has
 * happened yet", and the card is shown.
 */
export type CapabilityTri = "yes" | "no" | "unknown";

export type FileCapability = {
  tenantId: string;
  /** The file charges and reports GST. Structural: a cashbook never will. */
  hasGst: CapabilityTri;
  /** Tri-state and advisory only — never hides a card. See NOTE below. */
  hasPayroll: CapabilityTri;
  /** Transient signal: absence never hides Receivables. */
  usesInvoicing: CapabilityTri;
  /** Transient signal: absence never hides Payables. */
  usesBills: CapabilityTri;
  /** At least one FIXED-type account exists in the chart. */
  hasFixedAssetRegister: CapabilityTri;
  /** Accounts typed BANK. Feed status itself is not visible in a snapshot. */
  bankAccountCount: number | null;
  /** Which snapshot and which matched names produced each flag. */
  evidence: Record<string, string[]>;
  /**
   * Widget keys this file structurally cannot populate. ONLY structural
   * absence appears here. Everything else renders with an empty state.
   */
  hiddenWidgets: string[];
};

const WAGE_ACCOUNT = /wage|salar|payroll|superannuation|employee|staff|director'?s?\s*fee|payg/i;

function unknownCapability(tenantId: string): FileCapability {
  return {
    tenantId,
    hasGst: "unknown",
    hasPayroll: "unknown",
    usesInvoicing: "unknown",
    usesBills: "unknown",
    hasFixedAssetRegister: "unknown",
    bankAccountCount: null,
    evidence: { profile: ["No stored snapshots for this file yet — every card is shown."] },
    hiddenWidgets: [],
  };
}

async function safeSnapshot(
  supabase: any,
  tenantId: string,
  clientId: string | null | undefined,
  reportKey: string,
): Promise<any | null> {
  try {
    const hit = await readSnapshot({ supabase, tenantId, clientId: clientId ?? null, reportKey });
    return hit?.payload ?? null;
  } catch (e) {
    console.warn("[capability] snapshot read failed", { reportKey, message: (e as Error).message });
    return null;
  }
}

async function computeFileCapability(opts: {
  supabase: any;
  tenantId: string;
  clientId?: string | null;
}): Promise<FileCapability> {
  const { supabase, tenantId, clientId } = opts;

  const [orgPayload, accountsPayload, bsPayload, arPayload, apPayload] = await Promise.all([
    safeSnapshot(supabase, tenantId, clientId, "organisation"),
    safeSnapshot(supabase, tenantId, clientId, "accounts"),
    safeSnapshot(supabase, tenantId, clientId, "balance_sheet"),
    safeSnapshot(supabase, tenantId, clientId, "invoices_accrec_open"),
    safeSnapshot(supabase, tenantId, clientId, "invoices_accpay_open"),
  ]);

  if (!orgPayload && !accountsPayload && !bsPayload) return unknownCapability(tenantId);

  const evidence: Record<string, string[]> = {};
  const org = (orgPayload?.Organisations ?? [])[0] ?? null;
  const accounts: any[] = accountsPayload?.Accounts ?? [];

  // ---- hasGst — high confidence, structural -------------------------------
  // `Class` and `PaysTax` are Xero-set fields on the organisation, not a name
  // match. A NON_GST_CASHBOOK file has no GST ledger at all and never will.
  let hasGst: CapabilityTri = "unknown";
  if (org) {
    const klass = String(org.Class ?? "");
    const paysTax = org.PaysTax;
    if (klass === "NON_GST_CASHBOOK") {
      hasGst = "no";
      evidence.hasGst = [`organisation.Class = ${klass}`];
    } else if (paysTax === false) {
      hasGst = "no";
      evidence.hasGst = ["organisation.PaysTax = false"];
    } else {
      hasGst = "yes";
      evidence.hasGst = [`organisation.Class = ${klass || "unset"}`, `organisation.PaysTax = ${String(paysTax)}`];
    }
  } else {
    evidence.hasGst = ["organisation snapshot absent"];
  }

  // ---- hasPayroll — tri-state, advisory only ------------------------------
  // NOTE: this flag NEVER hides a card. Name matching has already produced
  // false negatives on PAYG, and a file with accounts called "Employee
  // Entitlements" or a numeric-only chart would be wrongly called payroll-free.
  // Only the narrowest possible case — a cashbook file with no wage accounts
  // AND no super/PAYG balance-sheet lines — is even recorded as `no`, and the
  // consequence of `no` is nothing at all.
  const bsNames: string[] = [];
  const walk = (rows: any[] | undefined) => {
    for (const r of rows ?? []) {
      const name = r?.Cells?.[0]?.Value;
      if (r?.RowType === "Row" && typeof name === "string" && name.trim()) bsNames.push(name.trim());
      walk(r?.Rows);
    }
  };
  walk(bsPayload?.Reports?.[0]?.Rows);

  const superOrPaygLines = bsNames.filter((n) => {
    const cat = classifyTaxLine(n);
    return cat === "super" || cat === "payg";
  });
  const wageAccounts = accounts
    .filter((a) => String(a?.Class ?? "") === "EXPENSE" && WAGE_ACCOUNT.test(String(a?.Name ?? "")))
    .map((a) => String(a.Name));

  let hasPayroll: CapabilityTri = "unknown";
  if (superOrPaygLines.length > 0 || wageAccounts.length > 0) {
    hasPayroll = "yes";
    evidence.hasPayroll = [...superOrPaygLines.map((n) => `balance_sheet: ${n}`), ...wageAccounts.map((n) => `accounts: ${n}`)];
  } else if (bsPayload && accountsPayload && org && String(org.Class ?? "") === "NON_GST_CASHBOOK") {
    hasPayroll = "no";
    evidence.hasPayroll = ["cashbook file with no wage accounts and no super/PAYG balance-sheet lines (advisory only — hides nothing)"];
  } else {
    evidence.hasPayroll = ["no conclusive evidence either way"];
  }

  // ---- usesInvoicing / usesBills — TRANSIENT, never hides ------------------
  // Zero open invoices this week says nothing about the file. A card that
  // vanishes when trading goes well and returns when it goes badly destroys
  // trust in the whole dashboard, so absence is only ever `unknown`.
  const arCount = (arPayload?.Invoices ?? []).length;
  const apCount = (apPayload?.Invoices ?? []).length;
  const usesInvoicing: CapabilityTri = arCount > 0 ? "yes" : "unknown";
  const usesBills: CapabilityTri = apCount > 0 ? "yes" : "unknown";
  evidence.usesInvoicing = [`invoices_accrec_open: ${arCount} open`, "absence is transient — Receivables always renders"];
  evidence.usesBills = [`invoices_accpay_open: ${apCount} open`, "absence is transient — Payables always renders"];

  // ---- hasFixedAssetRegister ---------------------------------------------
  // Zero FIXED-type accounts means the chart has nowhere to put a fixed asset,
  // which is structural. Any FIXED account at all means show the card: the
  // flag says "fixed assets exist", never "the register is complete".
  const fixedAccounts = accounts.filter((a) => String(a?.Type ?? "") === "FIXED").map((a) => String(a.Name));
  let hasFixedAssetRegister: CapabilityTri = "unknown";
  if (accountsPayload) {
    hasFixedAssetRegister = fixedAccounts.length > 0 ? "yes" : "no";
    evidence.hasFixedAssetRegister = [`accounts: ${fixedAccounts.length} FIXED-type account(s)`];
  } else {
    evidence.hasFixedAssetRegister = ["accounts snapshot absent"];
  }

  const bankAccountCount = accountsPayload
    ? accounts.filter((a) => String(a?.Type ?? "") === "BANK").length
    : null;
  evidence.bankAccountCount = [
    bankAccountCount === null ? "accounts snapshot absent" : `accounts: ${bankAccountCount} BANK account(s)`,
    "feed status itself is not visible in a snapshot — no claim is made about it",
  ];

  // ---- the only two structural hides --------------------------------------
  const hiddenWidgets: string[] = [];
  if (hasGst === "no") hiddenWidgets.push("gst_reconciliation");
  if (hasFixedAssetRegister === "no") hiddenWidgets.push("fixed_assets_reconciliation");

  return {
    tenantId,
    hasGst,
    hasPayroll,
    usesInvoicing,
    usesBills,
    hasFixedAssetRegister,
    bankAccountCount,
    evidence,
    hiddenWidgets,
  };
}

/** Memoised for the life of one request: a dashboard renders many cards. */
export async function resolveFileCapability(opts: {
  supabase: any;
  tenantId: string;
  clientId?: string | null;
}): Promise<FileCapability> {
  return memoiseXeroGet(`capability\u0000${opts.tenantId}\u0000${opts.clientId ?? ""}`, () =>
    computeFileCapability(opts).catch((e) => {
      // Fail open: a broken profile must never hide a card.
      console.warn("[capability] profile failed", { tenantId: opts.tenantId, message: (e as Error).message });
      return unknownCapability(opts.tenantId);
    }),
  );
}
