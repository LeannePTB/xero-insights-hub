import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { listCostClassifications, setCostClassifications } from "@/lib/cost-classification.functions";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

type Classification = "fixed" | "variable" | "excluded" | "wages";

function lastNMonthsRange(n: number) {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - (n - 1), 1);
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: toISO(start), to: toISO(end) };
}

export function CostClassificationPanel({
  clientId,
  tenantId,
  tenantName,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
}) {
  const fetchPnl = useServerFn(getProfitAndLoss);
  const fetchClassifications = useServerFn(listCostClassifications);
  const saveClassifications = useServerFn(setCostClassifications);
  const qc = useQueryClient();

  const range = useMemo(() => lastNMonthsRange(12), []);

  const pnlQ = useQuery({
    queryKey: ["xero-pnl-accounts", tenantId, range.from, range.to],
    queryFn: () =>
      fetchPnl({
        data: {
          tenantId,
          fromDate: range.from,
          toDate: range.to,
          widget: "accounting_breakeven",
          basis: "accrual",
        },
      }),
    retry: false,
  });

  const classQ = useQuery({
    queryKey: ["cost-classifications", clientId, tenantId],
    queryFn: () => fetchClassifications({ data: { clientId, tenantId } }),
  });

  const [overrides, setOverrides] = useState<Record<string, Classification>>({});

  useEffect(() => {
    setOverrides({});
  }, [classQ.data, pnlQ.data]);

  const saved = useMemo(() => {
    const m: Record<string, Classification> = {};
    for (const r of classQ.data?.rows ?? []) m[r.account_name] = r.classification;
    return m;
  }, [classQ.data]);

  const accounts = useMemo(() => {
    const lines = pnlQ.data?.expenseLines ?? [];
    // Sort descending by absolute amount
    return [...lines].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [pnlQ.data]);

  const current = (name: string): Classification =>
    overrides[name] ?? saved[name] ?? "fixed";

  const dirty = Object.keys(overrides).filter((k) => overrides[k] !== (saved[k] ?? "fixed"));

  const saveMut = useMutation({
    mutationFn: async () => {
      const entries = dirty.map((accountName) => ({
        accountName,
        classification: overrides[accountName],
      }));
      return saveClassifications({ data: { clientId, tenantId, entries } });
    },
    onSuccess: () => {
      toast.success("Classifications saved");
      setOverrides({});
      qc.invalidateQueries({ queryKey: ["cost-classifications", clientId, tenantId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{tenantName}</p>
          <p className="text-xs text-muted-foreground">
            Accounts seen in the last 12 months of P&L. Default is Fixed.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => pnlQ.refetch()}
          disabled={pnlQ.isFetching}
          title="Refresh account list from Xero"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pnlQ.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {pnlQ.isLoading || classQ.isLoading ? (
        <div className="flex items-center py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading accounts…
        </div>
      ) : pnlQ.error ? (
        <p className="py-4 text-sm text-destructive">
          Couldn't load P&L: {(pnlQ.error as Error).message}
        </p>
      ) : accounts.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No expense accounts found in the last 12 months.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {accounts.map((a) => {
              const c = current(a.name);
              return (
                <li key={a.name} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "AUD",
                        maximumFractionDigits: 0,
                      }).format(a.amount)}{" "}
                      (12 mo)
                    </p>
                  </div>
                  <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                    {(["fixed", "variable", "excluded", "wages"] as Classification[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setOverrides((prev) => ({ ...prev, [a.name]: opt }))
                        }
                        className={`rounded px-2.5 py-1 capitalize transition ${
                          c === opt
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title={
                          opt === "excluded"
                            ? "Leave this account out of the Breakeven calculation entirely"
                            : opt === "wages"
                              ? "Tag this account as wages/salaries — used by Business Health Efficiency"
                              : undefined
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {dirty.length === 0
                ? "No changes."
                : `${dirty.length} unsaved change${dirty.length === 1 ? "" : "s"}.`}
            </p>
            <Button
              size="sm"
              onClick={() => saveMut.mutate()}
              disabled={dirty.length === 0 || saveMut.isPending}
            >
              {saveMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save classifications
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
