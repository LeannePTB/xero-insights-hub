// Server-only reconciliation engine for Loan Consolidation. Reconciles the
// selected loan accounts of the Xero files linked to one client against their
// configured counterparty accounts, sharing Xero balance/chart fetches across
// files to avoid hammering the API.

export type ClientTenant = {
  tenantId: string;
  tenantName: string;
};

export type ReconRowSide = {
  tenantId: string;
  tenantName: string;
  accountId: string;
  accountCode: string | null;
  accountName: string;
  /** Xero organisation short code, for building deep links. */
  shortCode: string | null;
  direction: "payable" | "receivable";
  /** Direction derived from the actual Xero balance sign (credit = payable). */
  actualDirection: "payable" | "receivable" | null;
  balance: number | null;
  error?: string;
};

export type ReconRow = {
  id: string;
  account: ReconRowSide;
  counterparty: ReconRowSide | null;
  net: number;
  status: "balanced" | "mismatch" | "unpaired" | "missing";
};

export type ReconFile = {
  tenant: ClientTenant;
  rows: ReconRow[];
  tenantErrors: Array<{ tenantId: string; error: string }>;
};

export type ReconResult = {
  asAt: string;
  tenant: ClientTenant;
  rows: ReconRow[];
  tenantErrors: Array<{ tenantId: string; error: string }>;
  files: ReconFile[];
};

type TenantBalances = {
  byAccountId: Map<string, number>;
  byAccountCode: Map<string, number>;
  byAccountName: Map<string, number>;
};

type TenantAccounts = {
  byAccountId: Set<string>;
  byAccountCode: Set<string>;
  byAccountName: Set<string>;
};

function normalizeAccountIdentity(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\([^()]+\)\s*$/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-AU");
}

export async function runLoanReconciliation(input: {
  supabase: any; // supabaseAdmin — access is gated by the caller
  clientId: string;
  tenantIds: string[] | null;
  asAt: string;
}): Promise<ReconResult> {
  const { supabase, clientId, asAt } = input;

  // Every Xero file linked to this client is a candidate.
  const { data: orgs } = await supabase
    .from("client_xero_orgs")
    .select("xero_connections(tenant_id, tenant_name)")
    .eq("client_id", clientId);
  const tenantById = new Map<string, ClientTenant>();
  for (const o of (orgs ?? []) as any[]) {
    const t = o?.xero_connections;
    if (t?.tenant_id && !tenantById.has(t.tenant_id)) {
      tenantById.set(t.tenant_id, {
        tenantId: t.tenant_id,
        tenantName: t.tenant_name ?? "(unnamed)",
      });
    }
  }

  let targetTenantIds: string[];
  if (input.tenantIds && input.tenantIds.length > 0) {
    for (const tid of input.tenantIds) {
      if (!tenantById.has(tid)) throw new Error("Selected Xero file isn't linked to this client");
    }
    targetTenantIds = input.tenantIds;
  } else {
    const allIds = Array.from(tenantById.keys());
    const { data: selTenants } = allIds.length
      ? await supabase
          .from("loan_consolidation_accounts")
          .select("tenant_id")
          .in("tenant_id", allIds)
      : { data: [] as any[] };
    const withAccounts = new Set(((selTenants ?? []) as any[]).map((r) => r.tenant_id));
    targetTenantIds = allIds
      .filter((id) => withAccounts.has(id))
      .sort((a, b) => (tenantById.get(a)?.tenantName ?? "").localeCompare(tenantById.get(b)?.tenantName ?? ""));
  }
  if (targetTenantIds.length === 0) {
    throw new Error("No Xero files with selected loan accounts for this client");
  }

  // Selected accounts for the target files plus their counterparties.
  const { data: primaryRowsRaw, error: sErr } = await supabase
    .from("loan_consolidation_accounts")
    .select(
      "id, client_id, tenant_id, account_id, account_code, account_name, direction, counterparty_account_id, sort_order",
    )
    .eq("client_id", clientId)
    .in("tenant_id", targetTenantIds)
    .order("sort_order", { ascending: true })
    .order("account_code", { ascending: true });
  if (sErr) throw new Error(sErr.message);
  const primaryRows = (primaryRowsRaw ?? []) as any[];

  const counterpartyIds = Array.from(
    new Set(
      primaryRows
        .map((r) => r.counterparty_account_id as string | null)
        .filter((v): v is string => !!v),
    ),
  );
  let cptyRows: any[] = [];
  if (counterpartyIds.length > 0) {
    const { data: cptyRaw } = await supabase
      .from("loan_consolidation_accounts")
      .select("id, tenant_id, account_id, account_code, account_name, direction")
      .in("id", counterpartyIds);
    cptyRows = (cptyRaw ?? []) as any[];
  }
  const cptyById = new Map<string, any>();
  for (const r of cptyRows) cptyById.set(r.id, r);

  const neededTenantIds = new Set<string>(targetTenantIds);
  for (const c of cptyRows) neededTenantIds.add(c.tenant_id);
  const allTenantIds = Array.from(neededTenantIds);

  const { fetchTrialBalance, listAllAccounts, getShortCode } = await import("./xero/loan-xero.server");

  const tenantErrors: Array<{ tenantId: string; error: string }> = [];
  const balancesByTenant = new Map<string, TenantBalances>();
  const accountsByTenant = new Map<string, TenantAccounts>();
  const shortCodeByTenant = new Map<string, string | null>();

  const BATCH = 3;
  for (let i = 0; i < allTenantIds.length; i += BATCH) {
    await Promise.all(
      allTenantIds.slice(i, i + BATCH).map(async (tid) => {
        try {
          const [balances, accts, shortCode] = await Promise.all([
            fetchTrialBalance({ tenantId: tid, date: asAt }),
            listAllAccounts(tid).catch(() => [] as any[]),
            getShortCode(tid),
          ]);
          balancesByTenant.set(tid, balances);
          shortCodeByTenant.set(tid, shortCode);
          const acc: TenantAccounts = {
            byAccountId: new Set(),
            byAccountCode: new Set(),
            byAccountName: new Set(),
          };
          for (const a of accts) {
            if (a.AccountID) acc.byAccountId.add(a.AccountID);
            if (a.Code) acc.byAccountCode.add(a.Code.trim().toLocaleLowerCase("en-AU"));
            if (a.Name) acc.byAccountName.add(a.Name.trim().toLocaleLowerCase("en-AU"));
          }
          accountsByTenant.set(tid, acc);
        } catch (e: any) {
          tenantErrors.push({ tenantId: tid, error: e?.message ?? String(e) });
        }
      }),
    );
  }

  function resolveSide(side: {
    tenantId: string;
    accountId: string;
    accountCode: string | null;
    accountName: string;
    direction: "payable" | "receivable";
  }): ReconRowSide {
    const t = tenantById.get(side.tenantId);
    const bal = balancesByTenant.get(side.tenantId);
    const accts = accountsByTenant.get(side.tenantId);
    const tErr = tenantErrors.find((e) => e.tenantId === side.tenantId);
    const idBal = bal?.byAccountId.get(side.accountId);
    const codeBal = side.accountCode
      ? bal?.byAccountCode.get(normalizeAccountIdentity(side.accountCode))
      : undefined;
    const nameBal = bal?.byAccountName.get(normalizeAccountIdentity(side.accountName));
    const matched = idBal ?? codeBal ?? nameBal;
    const existsInChart =
      !!accts &&
      (accts.byAccountId.has(side.accountId) ||
        (side.accountCode
          ? accts.byAccountCode.has(side.accountCode.trim().toLocaleLowerCase("en-AU"))
          : false) ||
        accts.byAccountName.has(side.accountName.trim().toLocaleLowerCase("en-AU")));
    const raw = matched ?? (bal && existsInChart ? 0 : null);
    const error =
      tErr?.error ??
      (bal && matched === undefined && !existsInChart
        ? `Account ${side.accountCode ? `${side.accountCode} · ` : ""}${side.accountName} was not found in this Xero file (may have been archived or deleted)`
        : undefined);
    return {
      tenantId: side.tenantId,
      tenantName: t?.tenantName ?? "(unknown)",
      accountId: side.accountId,
      accountCode: side.accountCode,
      accountName: side.accountName,
      shortCode: shortCodeByTenant.get(side.tenantId) ?? null,
      direction: side.direction,
      actualDirection: raw === null ? null : raw < 0 ? "payable" : "receivable",
      balance: raw,
      error,
    };
  }

  function buildRow(r: any): ReconRow {
    const account = resolveSide({
      tenantId: r.tenant_id,
      accountId: r.account_id,
      accountCode: r.account_code,
      accountName: r.account_name,
      direction: r.direction === "receivable" ? "receivable" : "payable",
    });
    const cp = r.counterparty_account_id ? cptyById.get(r.counterparty_account_id) : null;
    const counterparty: ReconRowSide | null = cp
      ? resolveSide({
          tenantId: cp.tenant_id,
          accountId: cp.account_id,
          accountCode: cp.account_code,
          accountName: cp.account_name,
          direction: cp.direction === "receivable" ? "receivable" : "payable",
        })
      : null;

    const net = Math.round(((account.balance ?? 0) + (counterparty?.balance ?? 0)) * 100) / 100;

    let status: ReconRow["status"];
    if (!counterparty) status = "unpaired";
    else if (account.error || counterparty.error) status = "missing";
    else if (Math.abs(net) <= 0.01) status = "balanced";
    else status = "mismatch";

    return { id: r.id, account, counterparty, net, status };
  }

  const files: ReconFile[] = targetTenantIds.map((tid) => {
    const rows = primaryRows.filter((r) => r.tenant_id === tid).map(buildRow);
    const relevantTenantIds = new Set<string>([tid]);
    for (const row of rows) {
      if (row.counterparty) relevantTenantIds.add(row.counterparty.tenantId);
    }
    return {
      tenant: tenantById.get(tid)!,
      rows,
      tenantErrors: tenantErrors.filter((e) => relevantTenantIds.has(e.tenantId)),
    };
  });

  const first = files[0];
  return {
    asAt,
    tenant: first.tenant,
    rows: first.rows,
    tenantErrors: first.tenantErrors,
    files,
  };
}
