// Server-only Xero fixed asset register reader.
//
// The Fixed Assets Reconciliation card was removed; this file remains because
// the Balance Sheet Reconciliation still reads the asset register.
//
// Compares Xero's fixed asset register (assets.xro/1.0) against the fixed
// asset accounts on the general ledger. Fail closed: if the register cannot be
// read the rows are marked unavailable, never zero. An EMPTY register is a
// different thing from an unreadable one, and is reported as such — every
// GL balance then shows as a difference, which is the point.

import type { Connection } from "./api.server";
import { errText } from "./recon-shared.server";



type RegisterAccount = { cost: number; accumulated: number; priorAccumulated: number };

export type RegisterSnapshot = {
  available: boolean;
  assetCount: number;
  draftCount: number;
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
 *  period is visible. DRAFT assets are counted separately: a draft is not
 *  registered and does not depreciate, so it never reconciles the GL — but
 *  "no assets entered" and "assets entered but not registered" need different
 *  actions, so they must not look the same. */
export async function fetchAssetRegister(conn: Connection, asAt: string): Promise<RegisterSnapshot> {
  const { xeroGetAssets } = await import("./api.server");
  try {
    const types = await xeroGetAssets<any[]>(conn, "AssetTypes");
    const typeById = new Map<string, any>();
    for (const t of types ?? []) if (t?.assetTypeId) typeById.set(String(t.assetTypeId).toLowerCase(), t);

    const items: any[] = [];
    const draftItems: any[] = [];
    for (const status of ["REGISTERED", "DISPOSED", "DRAFT"]) {
      for (let page = 1; page <= 40; page++) {
        const res = await xeroGetAssets<any>(conn, "Assets", {
          status,
          page: String(page),
          pageSize: "100",
        });
        const batch: any[] = res?.items ?? [];
        if (status === "DRAFT") draftItems.push(...batch);
        else items.push(...batch);
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
    // Drafts entered on or before the period end are the ones awaiting
    // registration at that date.
    const draftCount = draftItems.filter((a) => {
      const purchase = String(a?.purchaseDate ?? "").slice(0, 10);
      return !purchase || purchase <= asAt;
    }).length;

    return { available: true, assetCount: counted, draftCount, byAccount };
  } catch (e) {
    return { available: false, assetCount: 0, draftCount: 0, byAccount: new Map(), reason: errText(e) };
  }
}
