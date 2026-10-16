// Stored-only loader for the shared forward tax summary. Never calls Xero.
// Every read uses the caller's own client, so RLS applies; IDs are filters.
import { currentGstPeriod, type ForwardTax } from "@/components/dashboard/tax-obligations";
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
  const [cl, gst, snaps, inst] = await Promise.all([
    sb.from("clients").select("id, gst_cycle, payg_withholding_cycle").in("id", ids),
    sb.from("reconciliation_snapshots").select("client_id, report_key, as_at, payload, complete").in("client_id", ids).in("report_key", ["gst_reconciliation", "gst_reconciliation_quarter"]).in("as_at", asAts),
    sb.from("xero_snapshots").select("client_id, tenant_id, report_key, payload, payload_version, fetched_at, complete").in("client_id", ids).in("report_key", ["payroll_payruns", "invoices_accpay_open"]).order("fetched_at", { ascending: false }),
    sb.from("client_income_tax_instalments").select("client_id, tenant_id, period_end, amount").in("client_id", ids).order("period_end", { ascending: false }),
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
    const i = ((inst.data ?? []) as any[]).find((r) => r.client_id === t.clientId && (!t.tenantId || r.tenant_id === t.tenantId));
    const tax = buildStoredForward({
      today, gstCycle, paygCycle,
      gst: g?.payload ?? null,
      payRuns,
      payablesPayload: ap?.payload ?? null,
      instalment: i ? { amount: Number(i.amount), periodEnd: String(i.period_end) } : null,
    });
    out.set(t.clientId, { tax, payRuns });
  }
  return out;
}
