// Compare mode: the dual-run diff that gates every cut-over.
//
// Runs BOTH paths — stored snapshot and live Xero — for the same resolved
// parameters and reports every field that differs by more than one cent. It is
// permanent, not scaffolding: it is the fastest way to answer "is this figure
// wrong?" after a key has been flipped.
//
// Staff-only and read-only. It writes nothing, changes no entitlement, and
// costs the same Xero calls the live path always cost.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FieldDiff = { field: string; snapshot: number | string; live: number | string };

export type CompareResult = {
  tenantId: string;
  reportKey: string;
  snapshotAvailable: boolean;
  snapshotAsAt: string | null;
  snapshotComplete: boolean;
  diffs: FieldDiff[];
  error?: string;
};

const CENT = 0.011;

function diffNumbers(
  out: FieldDiff[],
  field: string,
  snapshot: number,
  live: number,
) {
  if (Math.abs(snapshot - live) > CENT) out.push({ field, snapshot, live });
}

export const compareSnapshotVsLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; reportKeys?: string[] }) => input)
  .handler(async ({ data, context }): Promise<{ results: CompareResult[] }> => {
    const { assertWidgetAccess } = await import("./access.server");
    // Same gate the widgets use; a tenantId is a filter, never a grant.
    await assertWidgetAccess(context.userId, data.tenantId, "receivables");

    const keys = data.reportKeys?.length
      ? data.reportKeys
      : ["invoices_accrec_open", "invoices_accpay_open"];

    const { readSnapshot } = await import("./snapshot-read.server");
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { INVOICE_PAGE_LIMIT } = await import("./snapshot-keys");

    const results: CompareResult[] = [];

    for (const reportKey of keys) {
      const side = reportKey === "invoices_accpay_open" ? "ACCPAY" : "ACCREC";
      const result: CompareResult = {
        tenantId: data.tenantId,
        reportKey,
        snapshotAvailable: false,
        snapshotAsAt: null,
        snapshotComplete: true,
        diffs: [],
      };

      try {
        const hit = await readSnapshot({
          supabase: context.supabase,
          tenantId: data.tenantId,
          reportKey,
        });
        if (!hit) {
          results.push(result);
          continue;
        }
        result.snapshotAvailable = true;
        result.snapshotAsAt = hit.source.asAt;
        result.snapshotComplete = hit.source.complete;

        const conn = await getConnectionByTenant(data.tenantId);
        const live: any[] = [];
        for (let page = 1; page <= INVOICE_PAGE_LIMIT; page++) {
          const res = await xeroGet<{ Invoices?: any[] }>(conn, "Invoices", {
            where: `Type=="${side}"&&Status!="PAID"&&Status!="VOIDED"&&Status!="DELETED"&&Status!="DRAFT"`,
            page: String(page),
            order: "DueDate ASC",
          });
          const batch = res.Invoices ?? [];
          live.push(...batch);
          if (batch.length < 100) break;
        }

        const snap = (hit.payload?.Invoices ?? []) as any[];
        const sum = (rows: any[]) =>
          rows.reduce((t, i) => t + (Number(i.AmountDue) || 0), 0);
        const count = (rows: any[]) => rows.filter((i) => (Number(i.AmountDue) || 0) > 0).length;

        diffNumbers(result.diffs, "totalOutstanding", sum(snap), sum(live));
        diffNumbers(result.diffs, "invoiceCount", count(snap), count(live));

        // Per-invoice comparison, keyed by InvoiceID — never by position.
        const byId = new Map<string, number>();
        for (const i of live) byId.set(i.InvoiceID, Number(i.AmountDue) || 0);
        for (const i of snap) {
          const liveAmount = byId.get(i.InvoiceID);
          if (liveAmount === undefined) {
            result.diffs.push({
              field: `invoice ${i.InvoiceNumber || i.InvoiceID} (settled since)`,
              snapshot: Number(i.AmountDue) || 0,
              live: "absent",
            });
            continue;
          }
          diffNumbers(
            result.diffs,
            `invoice ${i.InvoiceNumber || i.InvoiceID}`,
            Number(i.AmountDue) || 0,
            liveAmount,
          );
          byId.delete(i.InvoiceID);
        }
        for (const [id, amount] of byId) {
          result.diffs.push({ field: `invoice ${id} (raised since)`, snapshot: "absent", live: amount });
        }
      } catch (e) {
        result.error = e instanceof Error ? e.message.slice(0, 200) : String(e);
      }

      results.push(result);
    }

    return { results };
  });
