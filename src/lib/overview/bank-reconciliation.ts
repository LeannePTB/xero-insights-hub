// Per-account "bank not reconciled" signal. Pure: shared by the nightly
// key-figures writer (server), the overview, the feed and Trixie.
//
// Scope = the accounts that count as cash at bank after the client's saved
// bank-account settings (the same ID-keyed overlay cash uses), active only.
// Date per account = the oldest coded-but-unreconciled line on THAT account
// inside a recent window. Older leftover lines never pin the date back.

import { addDays } from "@/lib/sydney-time";
import { applyBankClassifications, type BankClassificationRow } from "@/lib/xero/bank-classifications";
import { BANK_NOT_RECONCILED } from "./thresholds";

export type AccountReconciliation = { accountId: string; name: string; reconciledTo: string | null };
export type BankReconciliation = { scope: "selected" | "all_active"; windowFrom: string; accounts: AccountReconciliation[] };

/** Lines older than this are treated as leftovers and ignored. */
export const RECON_WINDOW_DAYS = 90;

type Account = { AccountID?: string; Name?: string; Type?: string; BankAccountType?: string; Class?: string; Status?: string };

function isCashAccount(a: Account): boolean {
  const u = (v?: string) => String(v ?? "").trim().toUpperCase();
  return u(a.Type) === "BANK" && u(a.BankAccountType) !== "CREDITCARD" && u(a.Class) === "ASSET" && u(a.Status) === "ACTIVE";
}

/** In-scope accounts, or null when the accounts or the settings could not be read. */
export function accountsInScope(accounts: Account[] | null | undefined, rows: BankClassificationRow[] | null) {
  if (!Array.isArray(accounts) || rows === null) return null;
  const effective = applyBankClassifications(accounts as any[], rows) as Account[];
  return {
    scope: (rows.length ? "selected" : "all_active") as BankReconciliation["scope"],
    accounts: effective.filter(isCashAccount).filter((a) => a.AccountID),
  };
}

export function xeroDateOnly(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const iso = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const m = v.match(/Date\((-?\d+)/);
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : null;
}

type Pull = { items: any[]; complete: boolean } | null;

/**
 * Per-account reconciled-to dates. A pull that did not run makes everything
 * unknown (null). An account with no open line in the window is reconciled
 * to the as-at date, but only when the pull was complete; otherwise unknown.
 */
export function computeBankReconciliation(opts: {
  accounts: Account[] | null | undefined;
  classifications: BankClassificationRow[] | null;
  transactions: Pull;
  payments: Pull;
  asAt: string;
}): BankReconciliation | null {
  const scope = accountsInScope(opts.accounts, opts.classifications);
  if (!scope || !scope.accounts.length || !opts.transactions || !opts.payments) return null;
  const windowFrom = addDays(opts.asAt, -RECON_WINDOW_DAYS);
  const complete = opts.transactions.complete && opts.payments.complete;
  const oldest = new Map<string, string>();
  const note = (id: unknown, d: string | null) => {
    if (typeof id !== "string" || !d || d < windowFrom || d > opts.asAt) return;
    const k = id.toLowerCase();
    if (!oldest.has(k) || d < oldest.get(k)!) oldest.set(k, d);
  };
  for (const t of opts.transactions.items) if (t?.IsReconciled !== true) note(t?.BankAccount?.AccountID, xeroDateOnly(t?.Date));
  for (const p of opts.payments.items) if (p?.IsReconciled !== true) note(p?.Account?.AccountID, xeroDateOnly(p?.Date));
  return {
    scope: scope.scope,
    windowFrom,
    accounts: scope.accounts.map((a) => {
      const id = String(a.AccountID);
      return { accountId: id, name: String(a.Name ?? "Bank account"), reconciledTo: oldest.get(id.toLowerCase()) ?? (complete ? opts.asAt : null) };
    }),
  };
}

/** Oldest known date across in-scope accounts; null when none is known. */
export function oldestReconciledTo(r: BankReconciliation | null): string | null {
  const known = (r?.accounts ?? []).map((a) => a.reconciledTo).filter((d): d is string => !!d);
  return known.length ? known.sort()[0] : null;
}

/** Missing data is never stale: no warning. */
export function bankReconciledStale(reconciledTo: string | null, anchor: string): boolean {
  if (reconciledTo === null) return false;
  return reconciledTo <= addDays(anchor.slice(0, 10), -BANK_NOT_RECONCILED.staleDays);
}

function shortDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
}

export type BankReconWarning = { text: string; accounts: AccountReconciliation[] };

/** Named warning for stale in-scope accounts, or null (nothing shown). */
export function bankReconWarning(raw: unknown, anchor: string | null): BankReconWarning | null {
  const r = parseStored(raw);
  if (!r || !anchor) return null;
  const stale = r.accounts.filter((a) => bankReconciledStale(a.reconciledTo, anchor)).sort((a, b) => (a.reconciledTo! < b.reconciledTo! ? -1 : 1));
  if (!stale.length) return null;
  let text = stale.map((a) => `${a.name} — not reconciled since ${shortDate(a.reconciledTo!)}`).join("; ");
  if (r.scope === "all_active") text += " (using all active bank accounts — choose accounts in client settings)";
  return { text, accounts: stale };
}

/** Validates the stored JSON; anything unexpected reads as unavailable. */
export function parseStored(raw: unknown): BankReconciliation | null {
  const r = raw as any;
  if (!r || (r.scope !== "selected" && r.scope !== "all_active") || !Array.isArray(r.accounts)) return null;
  const ok = r.accounts.every((a: any) => typeof a?.accountId === "string" && typeof a?.name === "string" && (a.reconciledTo === null || /^\d{4}-\d{2}-\d{2}$/.test(a.reconciledTo)));
  return ok ? (r as BankReconciliation) : null;
}
