/**
 * Account setup: one decision per Xero account (keyed by AccountID).
 * Pure helpers only — suggestions, grouping and progress. Suggestions are
 * never stored and never change a figure; only a confirmed (saved) row does.
 */
import { classifyTaxLine } from "@/lib/xero/tax-lines";

export type SetupGroup = "bank" | "tax" | "cost";
export type BankValue = "bank" | "credit_card" | "overdraft" | "excluded";
export type TaxValue = "gst" | "payg" | "gst_payg" | "super" | "none";
export type CostValue = "wages" | "fixed" | "variable" | "excluded";
export type SetupValue = BankValue | TaxValue | CostValue;

export const VALUE_LABELS: Record<SetupGroup, [SetupValue, string][]> = {
  bank: [["bank", "Cash at bank"], ["credit_card", "Credit card"], ["overdraft", "Overdraft"], ["excluded", "Not cash"]],
  tax: [["gst", "GST"], ["payg", "PAYG withholding"], ["gst_payg", "GST + PAYG (combined ATO account)"], ["super", "Super owed"], ["none", "Not a tax account"]],
  cost: [["wages", "Wages"], ["fixed", "Fixed cost"], ["variable", "Variable cost"], ["excluded", "Leave out"]],
};

export type ChartAccount = {
  AccountID: string; Code?: string | null; Name: string;
  Class?: string | null; Type?: string | null; Status?: string | null; BankAccountType?: string | null;
};

const up = (s?: string | null) => String(s ?? "").trim().toUpperCase();
const PAYROLL_COST = /\b(wage|wages|salar(y|ies)|superannuation|super\b|workers'? ?comp|workcover|payroll tax|payroll)\b/i;
const TAX_WORDS = /\b(gst|bas|ato|payg|withholding|super|superannuation|integrated|ica|tax)\b/i;
const TAX_EXTRA = /\b(suspense|clearing)\b/i;

/** Group by Xero Class/Type first, name second. Expense "Superannuation" is a cost, never a tax account. */
export function groupFor(a: ChartAccount): SetupGroup | null {
  if (up(a.Status) !== "ACTIVE") return null;
  if (up(a.Type) === "BANK") return "bank";
  if (up(a.Class) === "EXPENSE") return "cost";
  return null;
}

/** Liability/asset accounts that look like tax or super (shown in Tax & super without being added). */
export function looksLikeTaxAccount(a: ChartAccount): boolean {
  if (up(a.Status) !== "ACTIVE" || up(a.Type) === "BANK") return false;
  const cls = up(a.Class);
  if (cls !== "LIABILITY" && cls !== "ASSET") return false;
  const name = a.Name ?? "";
  if (TAX_EXTRA.test(name)) return TAX_WORDS.test(name.replace(TAX_EXTRA, ""));
  return TAX_WORDS.test(name);
}

/** Tax-group eligibility for the "add another account" picker (same rule the save function enforces). */
export function canBeTaxAccount(a: ChartAccount): boolean {
  const cls = up(a.Class);
  return up(a.Status) === "ACTIVE" && up(a.Type) !== "BANK" && (cls === "LIABILITY" || cls === "ASSET");
}

export function suggest(group: SetupGroup, a: ChartAccount): SetupValue {
  if (group === "bank") return up(a.BankAccountType) === "CREDITCARD" || up(a.Class) === "LIABILITY" ? "credit_card" : "bank";
  if (group === "cost") {
    if (PAYROLL_COST.test(a.Name ?? "")) return "wages";
    return up(a.Type) === "DIRECTCOSTS" ? "variable" : "fixed";
  }
  const name = a.Name ?? "";
  const hasGst = /\b(gst|bas)\b/i.test(name);
  const hasPayg = /\b(payg|withholding)\b/i.test(name);
  if (hasGst && hasPayg) return "gst_payg";
  if (/\b(integrated|ica)\b/i.test(name) || (/\bato\b/i.test(name) && !hasGst && !hasPayg && !/super/i.test(name))) return "gst_payg";
  const detected = classifyTaxLine(name, a as any);
  if (detected === "gst" || detected === "payg" || detected === "super") return detected;
  return "none";
}

export type SetupRow = {
  key: string;
  group: SetupGroup;
  accountId: string | null;
  code: string | null;
  name: string;
  /** Saved decision, or null when nobody has decided. */
  stored: SetupValue | null;
  storedWagesVariable: boolean;
  suggestion: SetupValue;
  /** True when the account had P&L activity recently (costs only). */
  active: boolean;
  /** Legacy row whose account name no longer matches any Xero account. */
  unmatched: boolean;
  rowId: string | null;
};

export type StoredSetup = { id: string; account_id: string | null; setup_group: SetupGroup; value: SetupValue; wages_variable: boolean; account_name: string; match_status: string };

export function buildSetupRows(accounts: ChartAccount[], stored: StoredSetup[], activeNames: Set<string>): SetupRow[] {
  const byId = new Map(stored.filter((s) => s.account_id).map((s) => [String(s.account_id).toLowerCase(), s]));
  const rows: SetupRow[] = [];
  for (const a of accounts) {
    const s = byId.get(String(a.AccountID).toLowerCase());
    let group: SetupGroup | null = s?.setup_group ?? groupFor(a);
    if (!group && looksLikeTaxAccount(a)) group = "tax";
    if (!group) continue;
    if (!s && up(a.Status) !== "ACTIVE") continue;
    rows.push({
      key: a.AccountID, group, accountId: a.AccountID, code: a.Code ?? null, name: a.Name,
      stored: s?.value ?? null, storedWagesVariable: s?.wages_variable ?? false,
      suggestion: suggest(group, a),
      active: group !== "cost" || activeNames.has(a.Name.trim().toLowerCase()),
      unmatched: false, rowId: null,
    });
  }
  for (const s of stored) {
    if (s.match_status !== "unmatched") continue;
    rows.push({ key: `u:${s.id}`, group: s.setup_group, accountId: null, code: null, name: s.account_name, stored: s.value, storedWagesVariable: s.wages_variable, suggestion: s.value, active: true, unmatched: true, rowId: s.id });
  }
  return rows.sort((x, y) => x.name.localeCompare(y.name));
}

export function progress(rows: SetupRow[]): { done: number; total: number } {
  const real = rows.filter((r) => !r.unmatched);
  return { done: real.filter((r) => r.stored !== null).length, total: real.length };
}
