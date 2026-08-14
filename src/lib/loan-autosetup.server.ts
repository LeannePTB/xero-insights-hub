// Server-only helper that reads each Xero file's chart of accounts and works
// out which accounts are intercompany loans, pairing each one with the
// matching account in the counterparty file (e.g. X1's "Loan - X4" against
// X4's "Loan - X1"). Used to seed a consolidation group's loan setup.

type TenantInfo = { tenantId: string; tenantName: string; clientId: string; clientName: string };

type Candidate = {
  tenantId: string;
  clientId: string;
  accountId: string;
  code: string | null;
  name: string;
  type: string | null;
  /** Tenant this account appears to refer to. */
  counterpartyTenantId: string | null;
};

function norm(s: string): string {
  return s
    .toLocaleLowerCase("en-AU")
    .replace(/\b(pty|ltd|limited|the|trust|trustee|group|holdings|australia|au)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((t) => t.length >= 3);
}

/** How strongly an account name refers to a company name. */
function refScore(accountName: string, companyName: string): number {
  const a = ` ${norm(accountName)} `;
  const full = norm(companyName);
  if (full && a.includes(` ${full} `)) return full.length + 10;
  const ts = tokens(companyName);
  if (!ts.length) return 0;
  const hits = ts.filter((t) => a.includes(` ${t} `));
  if (!hits.length) return 0;
  if (hits.length < ts.length && ts.length > 1 && hits.join("").length < 4) return 0;
  return hits.join("").length;
}

const LOANISH = /(loan|inter\s*co|intercompany|advance|related\s*part)/i;

export async function autoSetupLoanAccounts(input: {
  supabase: any; // supabaseAdmin — caller has already authorised
  clients: { clientId: string; clientName: string; tenantIds: string[] }[];
  tenantNameById: Record<string, string>;
  apply: boolean;
}) {
  const { supabase, apply } = input;
  const tenants: TenantInfo[] = [];
  for (const c of input.clients) {
    for (const tid of c.tenantIds) {
      tenants.push({
        tenantId: tid,
        tenantName: input.tenantNameById[tid] ?? c.clientName,
        clientId: c.clientId,
        clientName: c.clientName,
      });
    }
  }
  if (tenants.length < 2) throw new Error("The group needs at least two Xero files.");

  const { listAllAccounts } = await import("./xero/loan-xero.server");

  const errors: { tenantId: string; tenantName: string; error: string }[] = [];
  const accountsByTenant = new Map<string, any[]>();
  const BATCH = 3;
  for (let i = 0; i < tenants.length; i += BATCH) {
    await Promise.all(
      tenants.slice(i, i + BATCH).map(async (t) => {
        try {
          accountsByTenant.set(t.tenantId, (await listAllAccounts(t.tenantId)) ?? []);
        } catch (e: any) {
          errors.push({ tenantId: t.tenantId, tenantName: t.tenantName, error: e?.message ?? String(e) });
        }
      }),
    );
  }

  // Candidate loan accounts, each tagged with the file it appears to point at.
  const candidates: Candidate[] = [];
  for (const t of tenants) {
    for (const a of accountsByTenant.get(t.tenantId) ?? []) {
      if (a.Status && a.Status !== "ACTIVE") continue;
      if (a.Class !== "LIABILITY" && a.Class !== "ASSET") continue;
      if (a.Type === "BANK") continue;
      const name = (a.Name ?? "").trim();
      if (!name || !LOANISH.test(name)) continue;

      let best: { tenantId: string; score: number } | null = null;
      for (const other of tenants) {
        if (other.tenantId === t.tenantId) continue;
        const score = Math.max(refScore(name, other.clientName), refScore(name, other.tenantName));
        if (score > 0 && (!best || score > best.score)) best = { tenantId: other.tenantId, score };
      }
      candidates.push({
        tenantId: t.tenantId,
        clientId: t.clientId,
        accountId: a.AccountID,
        code: a.Code ?? null,
        name,
        type: a.Type ?? null,
        counterpartyTenantId: best?.tenantId ?? null,
      });
    }
  }

  const matched = candidates.filter((c) => c.counterpartyTenantId);
  const unmatched = candidates.filter((c) => !c.counterpartyTenantId);

  if (!apply) {
    return {
      applied: false,
      accounts: candidates.length,
      pairs: 0,
      unpaired: unmatched.length,
      errors,
      preview: candidates.map((c) => ({
        tenantId: c.tenantId,
        accountName: c.name,
        pointsAt: c.counterpartyTenantId ? input.tenantNameById[c.counterpartyTenantId] ?? null : null,
      })),
    };
  }

  // Insert (or reuse) every candidate as a selected loan account.
  const idByKey = new Map<string, string>();
  const { data: existing } = await supabase
    .from("loan_consolidation_accounts")
    .select("id, tenant_id, account_id")
    .in("tenant_id", tenants.map((t) => t.tenantId));
  for (const r of (existing ?? []) as any[]) {
    if (r.account_id) idByKey.set(`${r.tenant_id}|${r.account_id}`, r.id);
  }

  let created = 0;
  for (const c of candidates) {
    const key = `${c.tenantId}|${c.accountId}`;
    if (idByKey.has(key)) continue;
    const { data: inserted, error } = await supabase
      .from("loan_consolidation_accounts")
      .insert({
        client_id: c.clientId,
        tenant_id: c.tenantId,
        account_id: c.accountId,
        account_code: c.code,
        account_name: c.name,
        account_type: c.type,
        direction: "payable",
        sort_order: 0,
      })
      .select("id")
      .single();
    if (error) continue;
    idByKey.set(key, inserted.id as string);
    created += 1;
  }

  // Pair each matched account with the account in the counterparty file that
  // points back at it. Best score wins; each account is used once.
  const used = new Set<string>();
  let pairs = 0;
  for (const a of matched) {
    const aId = idByKey.get(`${a.tenantId}|${a.accountId}`);
    if (!aId || used.has(aId)) continue;
    const backRefs = matched
      .filter(
        (b) =>
          b.tenantId === a.counterpartyTenantId &&
          b.counterpartyTenantId === a.tenantId &&
          !used.has(idByKey.get(`${b.tenantId}|${b.accountId}`) ?? ""),
      )
      .sort((x, y) => refScore(y.name, a.name) - refScore(x.name, a.name));
    const b = backRefs[0];
    if (!b) continue;
    const bId = idByKey.get(`${b.tenantId}|${b.accountId}`);
    if (!bId) continue;
    await supabase.from("loan_consolidation_accounts").update({ counterparty_account_id: bId }).eq("id", aId);
    await supabase.from("loan_consolidation_accounts").update({ counterparty_account_id: aId }).eq("id", bId);
    used.add(aId);
    used.add(bId);
    pairs += 1;
  }

  return {
    applied: true,
    accounts: created,
    pairs,
    unpaired: candidates.length - used.size,
    errors,
    preview: [] as { tenantId: string; accountName: string; pointsAt: string | null }[],
  };
}
