// Stored-only loader for the shared forward tax summary. Never calls Xero.
// Every read uses the caller's own client, so RLS applies; IDs are filters.
import { currentGstPeriod, pickCurrentInstalment, type ForwardTax } from "@/components/dashboard/tax-obligations";
import { buildStoredForward } from "./forward-stored";

export type StoredForward = { tax: ForwardTax; payRuns: { paymentDate: string | null; tax: number; super?: number }[] | null };

export async function loadStoredForward(
  sb: any,
  targets: { clientId: string; tenantId: string | null }[],
  today: string,
): Promise<Map<string, StoredForward>> {
  const out = new Map<string, StoredForward>();
  const ids = Array.from(new Set(targets.map((t) => t.clientId))).slice(0, 500);
  if (!ids.length) return out;
  const asAts = Array.from(new Set([currentGstPeriod("monthly", today).asAt, currentGstPeriod("quarterly", today).asAt]));
  const { SNAPSHOT_PAYLOAD_VERSION } = await import("@/lib/xero/snapshot-keys");
  const { reconVersion } = await import("@/lib/xero/recon-versions");
  const { PERIOD_END_BS_KEYS, classifiedAccounts, periodEndTaxLookup, taxBalancesFromLines } = await import("@/lib/health/health-checks.server");
  const { analyseBalanceSheet, statutoryOverrideMap } = await import("@/lib/xero/tax-lines");
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [cl, gst, snaps, inst, bsQ, peQ, bankQ, statQ] = await Promise.all([
    sb.from("clients").select("id, gst_cycle, payg_withholding_cycle, income_tax_instalment_frequency").in("id", ids),
    sb.from("reconciliation_snapshots").select("client_id, report_key, as_at, payload, complete").in("client_id", ids).in("report_key", ["gst_reconciliation", "gst_reconciliation_quarter"]).in("as_at", asAts),
    sb.from("xero_snapshots").select("client_id, tenant_id, report_key, payload, payload_version, fetched_at, complete").in("client_id", ids).in("report_key", ["payroll_payruns", "invoices_accpay_open"]).order("fetched_at", { ascending: false }),
    sb.from("client_income_tax_instalments").select("client_id, tenant_id, period_end, amount").in("client_id", ids).order("period_end", { ascending: false }),
    sb.from("xero_snapshots").select("client_id, tenant_id, report_key, payload, payload_version, fetched_at, complete").in("client_id", ids).in("report_key", ["balance_sheet", "accounts"]).gte("fetched_at", since).order("fetched_at", { ascending: false }),
    sb.from("xero_snapshots").select("client_id, tenant_id, report_key, params, payload, payload_version, fetched_at, complete").in("client_id", ids).in("report_key", PERIOD_END_BS_KEYS as unknown as string[]).gte("fetched_at", new Date(Date.now() - 200 * 86_400_000).toISOString()).order("fetched_at", { ascending: false }),
    sb.from("account_setup_bank_v").select("client_id, tenant_id, account_id, classification").in("client_id", ids),
    sb.from("account_setup_statutory_v").select("client_id, account_name, category").in("client_id", ids),
  ]);
  for (const t of targets) {
    const c = ((cl.data ?? []) as any[]).find((r) => r.id === t.clientId);
    const gstCycle = c?.gst_cycle ?? null;
    const paygCycle = c?.payg_withholding_cycle ?? null;
    const period = currentGstPeriod(gstCycle, today);
    const key = period.kind === "quarter" ? "gst_reconciliation_quarter" : "gst_reconciliation";
    const g = ((gst.data ?? []) as any[]).find((r) => r.client_id === t.clientId && r.report_key === key && String(r.as_at).slice(0, 10) === period.asAt && Number(r.payload?.version ?? 0) >= reconVersion(key));
    const mine = ((snaps.data ?? []) as any[]).filter((r) => r.client_id === t.clientId && (!t.tenantId || r.tenant_id === t.tenantId) && r.payload_version === SNAPSHOT_PAYLOAD_VERSION);
    const pr = mine.find((r) => r.report_key === "payroll_payruns");
    const ap = mine.find((r) => r.report_key === "invoices_accpay_open");
    const payRuns = pr?.payload?.status === "available" && Array.isArray(pr.payload.payRuns) ? pr.payload.payRuns : null;
    const i0 = pickCurrentInstalment(
      ((inst.data ?? []) as any[]).filter((r) => r.client_id === t.clientId && (!t.tenantId || r.tenant_id === t.tenantId))
        .map((r) => ({ amount: Number(r.amount), periodEnd: String(r.period_end) })),
      c?.income_tax_instalment_frequency ?? null, today);
    const i = i0 ? { amount: i0.amount, period_end: i0.periodEnd } : null;
    // Ledger balances: the same tax-line extraction as Business Health and Overview.
    let ledger: Parameters<typeof buildStoredForward>[0]["ledger"] = null;
    const tenant = t.tenantId ?? mine.find((r) => r.report_key === "payroll_payruns")?.tenant_id ?? null;
    const ledgerRows = ((bsQ.data ?? []) as any[]).filter((r) => r.client_id === t.clientId && (!tenant || r.tenant_id === tenant) && r.payload_version === SNAPSHOT_PAYLOAD_VERSION);
    const bs = ledgerRows.find((r) => r.report_key === "balance_sheet");
    const acc = ledgerRows.find((r) => r.report_key === "accounts" && (!bs || r.tenant_id === bs.tenant_id));
    if (bs && Array.isArray(acc?.payload?.Accounts)) {
      const banks = ((bankQ.data ?? []) as any[]).filter((b) => b.client_id === t.clientId && b.tenant_id === bs.tenant_id);
      const overrides = statutoryOverrideMap(((statQ.data ?? []) as any[]).filter((o) => o.client_id === t.clientId));
      const accs = classifiedAccounts(acc.payload.Accounts, banks);
      const a = analyseBalanceSheet(bs.payload, accs, overrides);
      const current = a.taxLines.status === "assessed" ? taxBalancesFromLines(a.taxLines.lines, gstCycle, paygCycle) : a.taxLines.status === "absent" ? { gst: 0, payg: 0 } : null;
      const pe = ((peQ.data ?? []) as any[]).filter((r) => r.client_id === t.clientId && r.tenant_id === bs.tenant_id && r.payload_version === SNAPSHOT_PAYLOAD_VERSION);
      ledger = { current, periodEnd: periodEndTaxLookup(pe, accs, overrides, gstCycle, paygCycle) };
    }
    const tax = buildStoredForward({
      ledger,
      today, gstCycle, paygCycle,
      gst: g?.payload ?? null,
      payRuns,
      payablesPayload: ap?.payload ?? null,
      instalment: i ? { amount: Number(i.amount), periodEnd: String(i.period_end) } : null,
      instalmentFrequency: c?.income_tax_instalment_frequency ?? null,
    });
    out.set(t.clientId, { tax, payRuns });
  }
  return out;
}
