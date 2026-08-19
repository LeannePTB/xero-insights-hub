// Server-only Fixed Assets reconciliation engine.
//
// Compares Xero's fixed asset register (assets.xro/1.0) against the fixed
// asset accounts on the general ledger. Fail closed: if the register cannot be
// read the rows are marked unavailable, never zero. An EMPTY register is a
// different thing from an unreadable one, and is reported as such — every
// GL balance then shows as a difference, which is the point.

import type { Connection } from "./api.server";
import {
  bsValueFor,
  errText,
  fetchBalanceSheet,
  periodFor,
  round2,
  type BalanceSheet,
  type XeroAccount,
} from "./recon-shared.server";

export type FixedAssetRow = {
  key: string;
  label: string;
  isAccumulated: boolean;
  bs: { opening: number | null; closing: number | null };
  register: { opening: number | null; closing: number | null };
  difference: { opening: number | null; closing: number | null };
  status: "balanced" | "variance" | "unavailable";
  reason?: string;
};

export type FixedAssetsResult = {
  asAt: string;
  periodFrom: string;
  rows: FixedAssetRow[];
  totals: {
    bsClosing: number | null;
    registerClosing: number | null;
    differenceClosing: number | null;
  };
  registerAssetCount: number;
  registerEmpty: boolean;
  registerAvailable: boolean;
  registerAsAtToday: boolean;
  complete: boolean;
  issues: string[];
};

type RegisterAccount = { cost: number; accumulated: number; priorAccumulated: number };

export type RegisterSnapshot = {
  available: boolean;
  assetCount: number;
  byAccount: Map<string, RegisterAccount>;
  reason?: string;
};

function bump(map: Map<string, RegisterAccount>, accountId: string | undefined, patch: Partial<RegisterAccount>) {
  if (!accountId) return;
  const key = accountId.toLowerCase();
  const cur = map.get(key) ?? { cost: 0, accumulated: 0, priorAccumulated: 0 };
  map.set(key, {
    cost: cur.cost + (patch.cost ?? 0),
    accumulated: cur.accumulated + (patch.accumulated ?? 0),
    priorAccumulated: cur.priorAccumulated + (patch.priorAccumulated ?? 0),
  });
}

/** Read the asset register and total it by the GL account each asset type
 *  posts to. Registered and disposed assets are both read so a disposal in the
 *  period is visible. */
export async function fetchAssetRegister(conn: Connection, asAt: string): Promise<RegisterSnapshot> {
  const { xeroGetAssets } = await import("./api.server");
  try {
    const types = await xeroGetAssets<any[]>(conn, "AssetTypes");
    const typeById = new Map<string, any>();
    for (const t of types ?? []) if (t?.assetTypeId) typeById.set(String(t.assetTypeId).toLowerCase(), t);

    const items: any[] = [];
    for (const status of ["REGISTERED", "DISPOSED"]) {
      for (let page = 1; page <= 40; page++) {
        const res = await xeroGetAssets<any>(conn, "Assets", {
          status,
          page: String(page),
          pageSize: "100",
        });
        const batch: any[] = res?.items ?? [];
        items.push(...batch);
        const pageCount = res?.pagination?.pageCount ?? 1;
        if (page >= pageCount || batch.length === 0) break;
      }
    }

    const byAccount = new Map<string, RegisterAccount>();
    let counted = 0;
    for (const a of items) {
      const purchase = String(a?.purchaseDate ?? "").slice(0, 10);
      if (purchase && purchase > asAt) continue; // not yet an asset at the period end
      const disposal = String(a?.disposalDate ?? "").slice(0, 10);
      if (disposal && disposal <= asAt) continue; // gone by the period end
      counted += 1;
      const type = typeById.get(String(a?.assetTypeId ?? "").toLowerCase());
      const costAccount = type?.fixedAssetAccountId ?? a?.assetTypeAccountId;
      const accumAccount = type?.accumulatedDepreciationAccountId;
      const cost = Number(a?.purchasePrice) || 0;
      const detail = a?.bookDepreciationDetail ?? {};
      const accum = Number(detail?.currentAccumDepreciationAmount) || 0;
      const prior = Number(detail?.priorAccumDepreciationAmount) || 0;
      bump(byAccount, costAccount, { cost });
      bump(byAccount, accumAccount, { accumulated: accum, priorAccumulated: prior });
    }
    return { available: true, assetCount: counted, byAccount };
  } catch (e) {
    return { available: false, assetCount: 0, byAccount: new Map(), reason: errText(e) };
  }
}

export async function computeFixedAssetsReconciliation(
  conn: Connection,
  asAt: string,
): Promise<FixedAssetsResult> {
  const { xeroGet } = await import("./api.server");
  const { from, priorEnd } = periodFor(asAt);
  const issues: string[] = [];
  let complete = true;

  let accounts: XeroAccount[] = [];
  let closingBs: BalanceSheet | null = null;
  let openingBs: BalanceSheet | null = null;
  try {
    const [accRes, closing] = await Promise.all([
      xeroGet<{ Accounts?: XeroAccount[] }>(conn, "Accounts", {}),
      fetchBalanceSheet(conn, asAt),
    ]);
    accounts = accRes.Accounts ?? [];
    closingBs = closing;
  } catch (e) {
    complete = false;
    issues.push(`Balance Sheet unavailable: ${errText(e)}`);
  }
  try {
    openingBs = await fetchBalanceSheet(conn, priorEnd);
  } catch (e) {
    complete = false;
    issues.push(`Opening Balance Sheet unavailable: ${errText(e)}`);
  }

  const register = await fetchAssetRegister(conn, asAt);
  if (!register.available) {
    complete = false;
    issues.push(`Asset register unavailable: ${register.reason}`);
  }

  const fixedAccounts = accounts.filter((a) => a.Type === "FIXED");
  const rows: FixedAssetRow[] = [];
  for (const acc of fixedAccounts) {
    const bsClosing = closingBs ? bsValueFor(closingBs, acc) : null;
    const bsOpening = openingBs ? bsValueFor(openingBs, acc) : null;
    if (bsClosing === null && bsOpening === null) continue; // not on the balance sheet at all
    const isAccum = /accum/i.test(acc.Name);
    const reg = register.byAccount.get(acc.AccountID.toLowerCase());
    const regClosing = register.available
      ? isAccum
        ? -(reg?.accumulated ?? 0)
        : reg?.cost ?? 0
      : null;
    const regOpening = register.available
      ? isAccum
        ? -(reg?.priorAccumulated ?? 0)
        : reg?.cost ?? 0
      : null;
    const diffClosing =
      bsClosing !== null && regClosing !== null ? round2(bsClosing - regClosing) : null;
    const diffOpening =
      bsOpening !== null && regOpening !== null ? round2(bsOpening - regOpening) : null;
    rows.push({
      key: acc.AccountID,
      label: acc.Name,
      isAccumulated: isAccum,
      bs: { opening: bsOpening === null ? null : round2(bsOpening), closing: bsClosing === null ? null : round2(bsClosing) },
      register: { opening: regOpening, closing: regClosing },
      difference: { opening: diffOpening, closing: diffClosing },
      status:
        diffClosing === null
          ? "unavailable"
          : Math.abs(diffClosing) < 0.005
            ? "balanced"
            : "variance",
      reason:
        diffClosing === null
          ? register.available
            ? "The Balance Sheet balance could not be loaded."
            : register.reason
          : undefined,
    });
  }

  rows.sort((a, b) => {
    const rank = (r: FixedAssetRow) =>
      r.status === "unavailable" ? 0 : r.status === "variance" ? 1 : 2;
    return rank(a) - rank(b) || a.label.localeCompare(b.label);
  });

  const sum = (pick: (r: FixedAssetRow) => number | null) =>
    rows.some((r) => pick(r) === null) ? null : round2(rows.reduce((s, r) => s + (pick(r) as number), 0));

  return {
    asAt,
    periodFrom: from,
    rows,
    totals: {
      bsClosing: sum((r) => r.bs.closing),
      registerClosing: sum((r) => r.register.closing),
      differenceClosing: sum((r) => r.difference.closing),
    },
    registerAssetCount: register.assetCount,
    registerEmpty: register.available && register.assetCount === 0,
    registerAvailable: register.available,
    // Xero's register reports accumulated depreciation as at today, not as at
    // an arbitrary past date, so historic depreciation figures are indicative.
    registerAsAtToday: asAt < new Date().toISOString().slice(0, 10),
    complete,
    issues,
  };
}
