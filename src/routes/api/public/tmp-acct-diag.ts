// THROWAWAY read-only diagnostic. Delete after use.
import { createFileRoute } from "@tanstack/react-router";

const TENANT = "7a684121-3a8f-4162-aef9-d176b55571a1";
const SUSPECT = /suspense|clearing|unallocated|ask my accountant|holding/i;

export const Route = createFileRoute("/api/public/tmp-acct-diag")({
  server: {
    handlers: {
      GET: async () => {
        const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
        const conn = await getConnectionByTenant(TENANT);
        const res = await xeroGet<any>(conn, "Accounts");
        const accounts = (res?.Accounts ?? []) as any[];
        const withBalance = accounts.filter((a) => typeof a.CurrentBalance === "number");
        return Response.json({
          totalAccounts: accounts.length,
          accountsWithCurrentBalanceField: withBalance.length,
          balanceFieldByType: withBalance.reduce((m: Record<string, number>, a) => {
            m[a.Type] = (m[a.Type] ?? 0) + 1;
            return m;
          }, {}),
          suspectNameMatches: accounts
            .filter((a) => SUSPECT.test(a.Name ?? ""))
            .map((a) => ({
              name: a.Name,
              type: a.Type,
              class: a.Class,
              status: a.Status,
              hasCurrentBalance: typeof a.CurrentBalance === "number",
              currentBalance: a.CurrentBalance ?? null,
              keys: Object.keys(a),
            })),
          sampleNonBankKeys: Object.keys(accounts.find((a) => a.Type !== "BANK") ?? {}),
          sampleBankKeys: Object.keys(accounts.find((a) => a.Type === "BANK") ?? {}),
        });
      },
    },
  },
});
