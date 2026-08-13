import { useEffect, useState } from "react";

export type CostGroup = "cogs" | "fixed" | "variable";

export type GroupBasis = {
  mode: "actual" | "avg" | "override";
  /** Absolute dollar override. */
  value?: number;
  /** Percentage nudge applied to the actual, e.g. 10 for +10%. */
  pct?: number;
};

export type CostBasis = Record<CostGroup, GroupBasis>;

export const DEFAULT_COST_BASIS: CostBasis = {
  cogs: { mode: "actual" },
  fixed: { mode: "actual" },
  variable: { mode: "actual" },
};

export const COST_GROUP_LABELS: Record<CostGroup, string> = {
  cogs: "Cost of sales",
  fixed: "Fixed expenses",
  variable: "Variable expenses",
};

/**
 * Resolves the amount a group contributes to the scenario, given the real Xero
 * figure, the trailing 3-month average and the chosen basis.
 */
export function resolveGroupCost(actual: number, avg: number | null, basis: GroupBasis): number {
  if (basis.mode === "avg") return avg ?? actual;
  if (basis.mode === "override") {
    if (typeof basis.value === "number" && Number.isFinite(basis.value)) return basis.value;
    if (typeof basis.pct === "number" && Number.isFinite(basis.pct)) {
      return actual * (1 + basis.pct / 100);
    }
  }
  return actual;
}

/** Short description of the basis in use, for the summary card sub-line. */
export function basisNote(
  actual: number,
  avg: number | null,
  basis: GroupBasis,
  fmt: (n: number) => string,
): string | undefined {
  if (basis.mode === "avg") {
    return avg === null ? "3-mo avg unavailable" : `3-mo avg · actual ${fmt(actual)}`;
  }
  if (basis.mode === "override") {
    if (typeof basis.value === "number" && Number.isFinite(basis.value)) {
      return `Override · actual ${fmt(actual)}`;
    }
    if (typeof basis.pct === "number" && Number.isFinite(basis.pct)) {
      const sign = basis.pct >= 0 ? "+" : "";
      return `Override ${sign}${basis.pct}% · actual ${fmt(actual)}`;
    }
    return `Override not set · actual ${fmt(actual)}`;
  }
  return avg === null ? undefined : `3-mo avg ${fmt(avg)}`;
}

export function isModelled(basis: GroupBasis): boolean {
  return basis.mode !== "actual";
}

function parse(raw: string | null): CostBasis {
  if (!raw) return DEFAULT_COST_BASIS;
  try {
    const parsed = JSON.parse(raw);
    const pick = (g: CostGroup): GroupBasis => {
      const v = parsed?.[g];
      if (!v || (v.mode !== "avg" && v.mode !== "override")) return { mode: "actual" };
      return {
        mode: v.mode,
        value: typeof v.value === "number" ? v.value : undefined,
        pct: typeof v.pct === "number" ? v.pct : undefined,
      };
    };
    return { cogs: pick("cogs"), fixed: pick("fixed"), variable: pick("variable") };
  } catch {
    return DEFAULT_COST_BASIS;
  }
}

/** Session-persisted cost basis settings (cleared on sign-out, like the month). */
export function usePersistedCostBasis(
  key: string,
): [CostBasis, (group: CostGroup, next: GroupBasis) => void, () => void] {
  const [basis, setBasis] = useState<CostBasis>(() => {
    if (typeof window === "undefined") return DEFAULT_COST_BASIS;
    try {
      return parse(window.sessionStorage.getItem(key));
    } catch {
      return DEFAULT_COST_BASIS;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(basis));
    } catch {}
  }, [key, basis]);

  const update = (group: CostGroup, next: GroupBasis) =>
    setBasis((b) => ({ ...b, [group]: next }));
  const reset = () => setBasis(DEFAULT_COST_BASIS);

  return [basis, update, reset];
}
