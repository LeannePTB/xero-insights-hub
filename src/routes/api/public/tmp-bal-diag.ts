// THROWAWAY read-only diagnostic. Delete after use.
import { createFileRoute } from "@tanstack/react-router";

const TENANT = "7a684121-3a8f-4162-aef9-d176b55571a1";

export const Route = createFileRoute("/api/public/tmp-bal-diag")({
  server: {
    handlers: {
      GET: async () => {
        const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
        const conn = await getConnectionByTenant(TENANT);
        const today = new Date().toISOString().slice(0, 10);
        const [acctRes, bsRes, tbRes] = await Promise.all([
          xeroGet<any>(conn, "Accounts"),
          xeroGet<any>(conn, "Reports/BalanceSheet", { date: today }),
          xeroGet<any>(conn, "Reports/TrialBalance", { date: today }).catch((e) => ({
            error: String(e?.message ?? e),
          })),
        ]);
        const accounts = (acctRes?.Accounts ?? []) as any[];
        const byId = new Map(accounts.map((a) => [a.AccountID, a]));

        const walk = (report: any) => {
          const out: any[] = [];
          for (const section of report?.Rows ?? []) {
            for (const row of section?.Rows ?? []) {
              const cells = row?.Cells ?? [];
              const attr = (cells[0]?.Attributes ?? []).find((x: any) => x.Id);
              const id = attr?.Value;
              if (!id) continue;
              out.push({
                id,
                label: cells[0]?.Value,
                values: cells.slice(1).map((c: any) => c?.Value),
              });
            }
          }
          return out;
        };

        const bs = walk(bsRes?.Reports?.[0]);
        const tb = tbRes?.Reports?.[0] ? walk(tbRes.Reports[0]) : null;

        const describe = (rows: any[] | null) =>
          rows
            ? {
                rowCount: rows.length,
                matchedToAccount: rows.filter((r) => byId.has(r.id)).length,
                sample: rows.slice(0, 3),
              }
            : { error: (tbRes as any)?.error ?? "none" };

        const interesting = (rows: any[] | null, re: RegExp) =>
          (rows ?? [])
            .filter((r) => re.test(String(r.label ?? "")) || re.test(String(byId.get(r.id)?.Name ?? "")))
            .map((r) => ({
              label: r.label,
              type: byId.get(r.id)?.Type ?? null,
              class: byId.get(r.id)?.Class ?? null,
              status: byId.get(r.id)?.Status ?? null,
              values: r.values,
            }));

        const archived = accounts.filter((a) => (a.Status ?? "").toUpperCase() === "ARCHIVED");
        return Response.json({
          today,
          bsColumnHeaders: (bsRes?.Reports?.[0]?.Rows ?? [])[0]?.Cells?.map((c: any) => c?.Value),
          tbColumnHeaders: (tbRes as any)?.Reports?.[0]?.Rows?.[0]?.Cells?.map((c: any) => c?.Value),
          balanceSheet: describe(bs),
          trialBalance: describe(tb),
          suspenseOnBS: interesting(bs, /suspense|clearing|unallocated|ask my accountant|holding/i),
          suspenseOnTB: interesting(tb, /suspense|clearing|unallocated|ask my accountant|holding/i),
          bankOnBS: (bs ?? [])
            .filter((r) => (byId.get(r.id)?.Type ?? "") === "BANK")
            .map((r) => ({ type: "BANK", values: r.values })),
          bankOnTB: (tb ?? [])
            .filter((r) => (byId.get(r.id)?.Type ?? "") === "BANK")
            .map((r) => ({ type: "BANK", values: r.values })),
          archivedAccounts: archived.length,
          archivedOnBS: (bs ?? []).filter((r) => (byId.get(r.id)?.Status ?? "") === "ARCHIVED").length,
          archivedOnTB: (tb ?? []).filter((r) => (byId.get(r.id)?.Status ?? "") === "ARCHIVED").length,
          archivedClasses: archived.reduce((m: Record<string, number>, a) => {
            m[a.Class] = (m[a.Class] ?? 0) + 1;
            return m;
          }, {}),
        });
      },
    },
  },
});
