/**
 * Single source of truth for how an expense account is classified.
 *
 * Every consumer (Accounting Break-Even, True Break-Even, the cash-flow
 * scenario and the settings panel) resolves through here so the same account
 * can never be treated as fixed by one card and variable by another.
 *
 * Rules, in order:
 *   1. A stored human tag always wins.
 *   2. Otherwise Xero's account type seeds a default:
 *        DIRECTCOSTS (cost of sales) -> variable
 *        OVERHEADS                   -> fixed
 *        EXPENSE / anything else     -> unclassified
 *   3. An unclassified account is treated as FIXED everywhere, and is counted
 *      so the cards can say so.
 *
 * Seeded values are derived at read time and never written to the database.
 */

export type Classification = "fixed" | "variable" | "excluded";
export type ClassificationSource = "manual" | "xero" | "default";

export type StoredClassification = {
  account_name: string;
  classification: Classification;
  is_wages?: boolean;
};

export type AccountRef = {
  /** Xero account code, when we can resolve one. */
  code?: string | null;
  name: string;
  /** Xero Account.Type, e.g. DIRECTCOSTS / OVERHEADS / EXPENSE. */
  type?: string | null;
  /** Xero Account.Class, e.g. EXPENSE / REVENUE. */
  class?: string | null;
};

export type ResolvedClassification = {
  /** What the calculation must use. Never null — unclassified means fixed. */
  effective: Classification;
  /** What was actually decided, or null when nothing has decided it. */
  decided: Classification | null;
  source: ClassificationSource;
  /** The Xero account type the seed came from, for display. */
  xeroType: string | null;
  isWages: boolean;
  unclassified: boolean;
};

/** One normalisation for every consumer — the scenario card used to lower-case, others did not. */
export function normaliseAccountKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Xero account type -> seeded classification. Returns null when Xero can't say. */
export function seedFromXeroType(type?: string | null): Classification | null {
  const t = (type ?? "").trim().toUpperCase();
  if (t === "DIRECTCOSTS") return "variable";
  if (t === "OVERHEADS") return "fixed";
  return null;
}

export type ClassificationResolver = {
  resolve: (accountName: string, accountCode?: string | null) => ResolvedClassification;
  /** Stored rows that no longer match any current Xero account. */
  orphans: StoredClassification[];
};

export function buildClassificationResolver({
  stored,
  accounts = [],
  /** When cost classification is switched off, everything is fixed and nothing is unclassified. */
  enabled = true,
}: {
  stored: StoredClassification[];
  accounts?: AccountRef[];
  enabled?: boolean;
}): ClassificationResolver {
  const byName = new Map<string, StoredClassification>();
  for (const row of stored) byName.set(normaliseAccountKey(row.account_name), row);

  // Match on account code where we can resolve one from Xero, falling back to
  // name. The stored rows are name-keyed, so a code match is only possible for
  // rows whose stored name still resolves to a current account.
  const nameToCode = new Map<string, string>();
  const byCode = new Map<string, StoredClassification>();
  const matchedNames = new Set<string>();
  for (const acc of accounts) {
    const key = normaliseAccountKey(acc.name);
    const code = (acc.code ?? "").trim();
    if (code) nameToCode.set(key, code);
    const row = byName.get(key);
    if (row) {
      matchedNames.add(key);
      if (code) byCode.set(code, row);
    }
  }

  const typeByKey = new Map<string, string>();
  const typeByCode = new Map<string, string>();
  for (const acc of accounts) {
    if (!acc.type) continue;
    typeByKey.set(normaliseAccountKey(acc.name), acc.type);
    const code = (acc.code ?? "").trim();
    if (code) typeByCode.set(code, acc.type);
  }

  const orphans = stored.filter((r) => !matchedNames.has(normaliseAccountKey(r.account_name)));

  const resolve = (accountName: string, accountCode?: string | null): ResolvedClassification => {
    const key = normaliseAccountKey(accountName);
    const code = (accountCode ?? nameToCode.get(key) ?? "").trim();
    const row = (code ? byCode.get(code) : undefined) ?? byName.get(key);
    const xeroType = (code ? typeByCode.get(code) : undefined) ?? typeByKey.get(key) ?? null;

    if (!enabled) {
      return {
        effective: "fixed",
        decided: "fixed",
        source: "default",
        xeroType,
        isWages: row?.is_wages ?? false,
        unclassified: false,
      };
    }

    if (row) {
      return {
        effective: row.classification,
        decided: row.classification,
        source: "manual",
        xeroType,
        isWages: row.is_wages ?? false,
        unclassified: false,
      };
    }

    const seeded = seedFromXeroType(xeroType);
    if (seeded) {
      return {
        effective: seeded,
        decided: seeded,
        source: "xero",
        xeroType,
        isWages: false,
        unclassified: false,
      };
    }

    return {
      effective: "fixed",
      decided: null,
      source: "default",
      xeroType,
      isWages: false,
      unclassified: true,
    };
  };

  return { resolve, orphans };
}

export function xeroTypeLabel(type?: string | null): string {
  const t = (type ?? "").trim().toUpperCase();
  if (t === "DIRECTCOSTS") return "cost of sales";
  if (t === "OVERHEADS") return "overheads";
  if (t === "EXPENSE") return "expense";
  return t.toLowerCase() || "unknown";
}
