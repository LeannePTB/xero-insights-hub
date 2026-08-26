// Pure helpers for reading tax-liability lines out of a Xero Balance Sheet
// payload, and for turning them into the "protected money" figure.
//
// This module deliberately has NO imports: it is shared by live server
// functions (`reports.functions.ts`) and by the snapshot rules engine
// (`@/lib/health/rules.server`), and the rules engine must never pull the
// Xero API client into its import graph.

export type TaxLineCategory = "gst" | "payg" | "super" | "other-tax";

export type TaxLine = {
  name: string;
  amount: number;
  category: TaxLineCategory;
  accountId?: string;
};

type Row = {
  RowType?: string;
  Title?: string;
  Rows?: Row[];
  Cells?: { Value?: string }[];
};

export function parseTaxAmount(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.replace(/[, ]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function classifyTaxLine(name: string): TaxLineCategory | null {
  const n = name.toLowerCase();
  if (n.includes("gst") || n.includes("vat") || n.includes("sales tax")) return "gst";
  if (n.includes("payg") || n.includes("paye") || n.includes("withholding")) return "payg";
  if (n.includes("super")) return "super";
  if (n.includes("tax payable") || n.includes("income tax") || n.includes("bas"))
    return "other-tax";
  return null;
}

export function walkTaxRows(rows: Row[] | undefined, visit: (r: Row) => void) {
  if (!rows) return;
  for (const r of rows) {
    visit(r);
    if (r.Rows) walkTaxRows(r.Rows, visit);
  }
}

/** Pull every tax-classified line out of a Balance Sheet report payload. */
export function extractTaxLines(report: any): TaxLine[] {
  const lines: TaxLine[] = [];
  walkTaxRows(report?.Rows, (r) => {
    if (r.RowType !== "Row" || !r.Cells || r.Cells.length < 2) return;
    const name = r.Cells[0]?.Value;
    if (!name) return;
    const category = classifyTaxLine(name);
    if (!category) return;
    const amount = parseTaxAmount(r.Cells[1]?.Value);
    let accountId: string | undefined;
    for (const cell of r.Cells) {
      const attrs = (cell as any).Attributes;
      if (!Array.isArray(attrs)) continue;
      for (const a of attrs) {
        if (a?.Id === "account" && typeof a.Value === "string") accountId = a.Value;
      }
      if (accountId) break;
    }
    lines.push({ name, amount, category, accountId });
  });
  return lines;
}

// ---------------------------------------------------------------------------
// Protected money – money the business holds but does not own.
// ---------------------------------------------------------------------------

export type ProtectedMoneyComponentKey = "gst" | "payg" | "super";

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
};

/** Build the protected-money figure from already-extracted tax lines, so a
 *  caller that already has a Balance Sheet does not fetch it again. */
export function buildProtectedMoney(
  asAtDate: string,
  lines: { name: string; amount: number; category: TaxLineCategory }[],
): ProtectedMoney {
  const keys: ProtectedMoneyComponentKey[] = ["gst", "payg", "super"];
  const components: ProtectedMoneyComponent[] = keys.map((key) => {
    const matched = lines.filter((l) => l.category === key);
    const label = PROTECTED_MONEY_LABELS[key];
    if (!matched.length) {
      return {
        key,
        label,
        status: "unresolved",
        amount: null,
        accounts: [],
        reason: `${label}: no account in the Balance Sheet matched this component, so the amount is unknown (this is not zero).`,
      };
    }
    return {
      key,
      label,
      status: "resolved",
      amount: matched.reduce((s, l) => s + l.amount, 0),
      accounts: matched.map((l) => ({ name: l.name, amount: l.amount })),
    };
  });

  const unresolved = components.filter((c) => c.status === "unresolved").map((c) => c.key);
  const total = components.reduce((s, c) => s + (c.status === "resolved" ? c.amount : 0), 0);
  return { asAtDate, total, complete: unresolved.length === 0, components, unresolved };
}

/**
 * Cash at bank from a Balance Sheet payload: every leaf row under a section
 * whose title mentions "bank", excluding the section's own "Total …" row.
 */
export function extractCashAtBank(report: any): {
  total: number;
  accounts: { name: string; balance: number }[];
} {
  const accounts: { name: string; balance: number }[] = [];
  let total = 0;
  const sections: Row[] = report?.Rows ?? [];
  for (const section of sections) {
    const title = (section.Title || "").toLowerCase();
    if (!title.includes("bank")) continue;
    walkTaxRows(section.Rows, (r) => {
      if (r.RowType !== "Row" || !r.Cells || r.Cells.length < 2) return;
      const name = r.Cells[0]?.Value;
      if (!name) return;
      const amount = parseTaxAmount(r.Cells[1]?.Value);
      total += amount;
      if (!name.toLowerCase().startsWith("total ")) accounts.push({ name, balance: amount });
    });
  }
  return { total, accounts };
}
