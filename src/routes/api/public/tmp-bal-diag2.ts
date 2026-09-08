// THROWAWAY read-only diagnostic. Delete after use.
import { createFileRoute } from "@tanstack/react-router";

const TENANT = "7a684121-3a8f-4162-aef9-d176b55571a1";

export const Route = createFileRoute("/api/public/tmp-bal-diag2")({
  server: {
    handlers: {
      GET: async () => {
        const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
        const { ruleCoaHygiene, ruleBank, parseBalanceSheetBalances } = await import(
          "@/lib/xero/audit/rules.server"
        );
        const conn = await getConnectionByTenant(TENANT);
        const today = new Date().toISOString().slice(0, 10);
        const [accountsRes, bsRes] = await Promise.all([
          xeroGet<any>(conn, "Accounts"),
          xeroGet<any>(conn, "Reports/BalanceSheet", { date: today }).catch(() => null),
        ]);
        const accounts = (accountsRes?.Accounts ?? []) as any[];
        const balances = parseBalanceSheetBalances(bsRes?.Reports?.[0] ?? null);
        const findings = [...ruleCoaHygiene(accounts, null, balances), ...ruleBank(accounts, null, balances)];
        const balanceRules = findings.filter((f) =>
          ["coa.suspense_balance", "coa.archived_with_balance", "bank.negative_balance"].includes(f.ruleId),
        );
        return Response.json({
          balanceCount: balances.size,
          totalFindings: findings.length,
          balanceRuleFindings: balanceRules.map((f) => ({
            ruleId: f.ruleId,
            severity: f.severity,
            message: f.message,
          })),
        });
      },
    },
  },
});
