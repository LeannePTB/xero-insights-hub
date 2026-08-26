// Stage 5: the open-invoice resolver behind Receivables and Payables.
//
// Report keys: `invoices_accrec_open`, `invoices_accpay_open`.
//
// Both the stored and the live branch return the SAME raw Xero invoice
// objects, so the ageing maths downstream is byte-identical between them. That
// is deliberate: the only difference a cut-over may introduce is when the data
// was retrieved, never how it is computed.
//
// Access: `assertWidgetAccess` runs in the caller before this is reached. The
// snapshot read goes through `context.supabase`, so RLS applies as the caller.

import { INVOICE_PAGE_LIMIT } from "./snapshot-keys";
import { readSnapshot } from "./snapshot-read.server";
import { isSnapshotDisabled } from "./snapshot-flags";
import { connectionStatus } from "./snapshot-read.server";
import { liveSource, pendingSource, type SnapshotSource } from "./snapshot-source";

export type InvoiceSide = "ACCREC" | "ACCPAY";

const REPORT_KEY: Record<InvoiceSide, string> = {
  ACCREC: "invoices_accrec_open",
  ACCPAY: "invoices_accpay_open",
};

const XERO_PAGE_SIZE = 100;

export async function resolveOpenInvoices(opts: {
  supabase: any;
  tenantId: string;
  clientId?: string | null;
  side: InvoiceSide;
}): Promise<{ invoices: any[]; source: SnapshotSource }> {
  const reportKey = REPORT_KEY[opts.side];

  const rolledBack = isSnapshotDisabled(reportKey);

  const hit = rolledBack
    ? null
    : await readSnapshot({
        supabase: opts.supabase,
        tenantId: opts.tenantId,
        clientId: opts.clientId ?? null,
        reportKey,
      });
  if (hit) {
    const invoices = (hit.payload?.Invoices ?? []) as any[];
    return { invoices, source: hit.source };
  }

  if (!rolledBack) {
    // No stored figures yet (new connection, or refreshed after the last run).
    // Render "being prepared" rather than spending a render-time Xero call.
    return {
      invoices: [],
      source: pendingSource(await connectionStatus(opts.supabase, opts.tenantId)),
    };
  }

  // Live branch — unchanged behaviour, kept forever so a rollback costs an env
  // var and nothing else.
  const { getConnectionByTenant, xeroGet } = await import("./api.server");
  const conn = await getConnectionByTenant(opts.tenantId);
  const invoices: any[] = [];
  let truncated = false;
  for (let page = 1; page <= INVOICE_PAGE_LIMIT; page++) {
    const res = await xeroGet<{ Invoices?: any[] }>(conn, "Invoices", {
      where: `Type=="${opts.side}"&&Status!="PAID"&&Status!="VOIDED"&&Status!="DELETED"&&Status!="DRAFT"`,
      page: String(page),
      order: "DueDate ASC",
    });
    const batch = res.Invoices ?? [];
    invoices.push(...batch);
    if (batch.length < XERO_PAGE_SIZE) break;
    if (page === INVOICE_PAGE_LIMIT) truncated = true;
  }

  const source = liveSource("disabled");
  source.complete = !truncated;
  return { invoices, source };
}

/**
 * Xero short code for deep links. Free when the figures came from a snapshot
 * (the `organisation` report is already stored); one live call otherwise.
 */
export async function resolveShortCode(
  supabase: any,
  tenantId: string,
  mode: SnapshotSource["mode"],
): Promise<string | null> {
  if (mode === "snapshot") {
    const rolledBack = isSnapshotDisabled(reportKey);

  const hit = rolledBack
    ? null
    : await readSnapshot({ supabase, tenantId, reportKey: "organisation" });
    const orgs = hit?.payload?.Organisations ?? [];
    return orgs[0]?.ShortCode ?? null;
  }
  try {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const conn = await getConnectionByTenant(tenantId);
    const res = await xeroGet<{ Organisations?: { ShortCode?: string }[] }>(conn, "Organisations");
    return res.Organisations?.[0]?.ShortCode ?? null;
  } catch {
    return null;
  }
}
