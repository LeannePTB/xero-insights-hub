import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { getExpenseAccounts } from "@/lib/xero/accounts.functions";
import {
  listCostClassifications,
  setCostClassifications,
  removeCostClassifications,
} from "@/lib/cost-classification.functions";
import {
  buildClassificationResolver,
  normaliseAccountKey,
  type Classification,
} from "@/lib/cost-classification";
import {
  classificationChoice,
  classificationSourceLabel,
  type ClassificationChoice,
} from "@/components/dashboard/cost-classification-display";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

type AccountOverride = { classification?: ClassificationChoice; isWages?: boolean };

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
  /** Only Business Health is in the client's plan: show the Wages marker alone. */
  wagesOnly = false,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
  wagesOnly?: boolean;
}) {
  const fetchPnl = useServerFn(getProfitAndLoss);
  const fetchAccounts = useServerFn(getExpenseAccounts);
  const fetchClassifications = useServerFn(listCostClassifications);
  const saveClassifications = useServerFn(setCostClassifications);
  const removeClassifications = useServerFn(removeCostClassifications);
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

  const accountsQ = useQuery({
    queryKey: ["xero-expense-accounts", clientId, tenantId],
    queryFn: () => fetchAccounts({ data: { clientId, tenantId } }),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const classQ = useQuery({
    queryKey: ["cost-classifications", clientId, tenantId],
    queryFn: () => fetchClassifications({ data: { clientId, tenantId } }),
  });

  const [overrides, setOverrides] = useState<Record<string, AccountOverride>>({});

  useEffect(() => {
    setOverrides({});
  }, [classQ.data, pnlQ.data]);

  const resolver = useMemo(
    () =>
      buildClassificationResolver({
        stored: classQ.data?.rows ?? [],
        accounts: accountsQ.data?.accounts ?? [],
      }),
    [classQ.data, accountsQ.data],
  );

  const accounts = useMemo(() => {
    const expense = pnlQ.data?.expenseLines ?? [];
    const cogs = pnlQ.data?.cogsLines ?? [];
    // Merge expense + cost-of-sales accounts so wages booked under COGS can be tagged too.
    const seen = new Set<string>();
    const merged: { name: string; amount: number }[] = [];
    for (const l of [...expense, ...cogs]) {
      if (seen.has(l.name)) continue;
      seen.add(l.name);
      merged.push(l);
    }
    return merged;
  }, [pnlQ.data]);

  // A stored row is stale when its account no longer appears in either the
  // chart of accounts or the last 12 months of P&L.
  const orphans = useMemo(() => {
    const seenInPnl = new Set(accounts.map((a) => normaliseAccountKey(a.name)));
    return resolver.orphans.filter((o) => !seenInPnl.has(normaliseAccountKey(o.account_name)));
  }, [resolver, accounts]);

  const current = (name: string): ClassificationChoice =>
    overrides[name]?.classification ?? classificationChoice(resolver.resolve(name));

  const currentIsWages = (name: string): boolean =>
    overrides[name]?.isWages ?? resolver.resolve(name).isWages;

  const dirty = Object.keys(overrides).filter((k) => {
    const r = resolver.resolve(k);
    const override = overrides[k];
    return (
      override?.classification !== undefined ||
      (override?.isWages !== undefined && override.isWages !== r.isWages)
    );
  });

  const sortedAccounts = useMemo(
    () =>
      [...accounts].sort((a, b) => {
        const aUnclassified = current(a.name) === "unclassified";
        const bUnclassified = current(b.name) === "unclassified";
        if (aUnclassified !== bUnclassified) return aUnclassified ? -1 : 1;
        return Math.abs(b.amount) - Math.abs(a.amount);
      }),
    [accounts, overrides, resolver],
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const accountNames = dirty.filter((accountName) => current(accountName) === "unclassified");
      const entries = dirty
        .filter((accountName) => current(accountName) !== "unclassified")
        .map((accountName) => ({
          accountName,
          classification: current(accountName) as Classification,
          isWages: currentIsWages(accountName),
        }));
      if (accountNames.length > 0) {
        await removeClassifications({ data: { clientId, tenantId, accountNames } });
      }
      if (entries.length > 0) {
        await saveClassifications({ data: { clientId, tenantId, entries } });
      }
      return { ok: true };
    },
    onSuccess: () => {
      toast.success("Classifications saved");
      setOverrides({});
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (accountName: string) =>
      removeClassifications({ data: { clientId, tenantId, accountNames: [accountName] } }),
    onSuccess: () => {
      toast.success("Stale tag removed");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["cost-classifications", clientId, tenantId] });
    qc.invalidateQueries({ queryKey: ["xero-pnl"] });
    qc.invalidateQueries({ queryKey: ["scenario", clientId] });
    qc.invalidateQueries({ queryKey: ["business-health"] });
    qc.invalidateQueries({ queryKey: ["business-health-detail"] });
  }

  function sourceLabel(name: string): string {
    const r = resolver.resolve(name);
    const override = overrides[name];
    if (override?.classification === "unclassified") {
      return "Unsaved · will return to the default (treated as fixed if Xero cannot classify it)";
    }
    if (override?.classification !== undefined || override?.isWages !== undefined) {
      return "Unsaved change";
    }
    return classificationSourceLabel(r);
  }

  const unclassifiedCount = accounts.filter((a) => resolver.resolve(a.name).unclassified).length;

  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{tenantName}</p>
          <p className="text-xs text-muted-foreground">
            {wagesOnly
              ? "Accounts seen in the last 12 months of P&L. Mark which accounts are wages for Business Health."
              : "Accounts seen in the last 12 months of P&L. Fixed and Variable are seeded from Xero's account type; anything Xero can't say is treated as fixed until you decide."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            pnlQ.refetch();
            accountsQ.refetch();
          }}
          disabled={pnlQ.isFetching || accountsQ.isFetching}
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
          {!wagesOnly && unclassifiedCount > 0 && (
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              {unclassifiedCount} account{unclassifiedCount === 1 ? "" : "s"} still unclassified —
              treated as fixed in break-even and the cash-flow scenario.{" "}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-current underline underline-offset-2"
                onClick={() =>
                  document
                    .querySelector<HTMLElement>("[data-unclassified-account='true']")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
              >
                Show {unclassifiedCount === 1 ? "it" : "them"}
              </Button>
            </p>
          )}

          <ul className="divide-y divide-border">
            {sortedAccounts.map((a) => {
              const c = current(a.name);
              const isWages = currentIsWages(a.name);
              return (
                <li
                  key={a.name}
                  data-unclassified-account={c === "unclassified" ? "true" : undefined}
                  className="scroll-mt-8 flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "AUD",
                        maximumFractionDigits: 0,
                      }).format(a.amount)}{" "}
                      (12 mo){wagesOnly ? "" : ` · ${sourceLabel(a.name)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {!wagesOnly && (
                      <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                        {(["unclassified", "fixed", "variable", "excluded"] as ClassificationChoice[]).map((opt) => (
                          <Button
                            key={opt}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setOverrides((prev) => ({
                                ...prev,
                                [a.name]: { ...prev[a.name], classification: opt },
                              }))
                            }
                            className={`h-7 rounded px-2.5 text-xs capitalize transition ${
                              c === opt
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title={
                              opt === "unclassified"
                                ? "Remove the stored classification and return this account to its default. If Xero cannot classify it, calculations treat it as fixed."
                                : opt === "excluded"
                                ? "Leave this account out of the Breakeven calculation entirely"
                                : undefined
                            }
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setOverrides((prev) => ({
                          ...prev,
                          [a.name]: { ...prev[a.name], isWages: !isWages },
                        }))
                      }
                      className={`h-7 px-2.5 text-xs transition ${
                        isWages
                          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                      title="Mark as wages/salaries for Business Health Efficiency without changing fixed-cost treatment"
                    >
                      Wages
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          {orphans.length > 0 && (
            <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold">Stale tags</p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                These accounts are no longer in Xero — most likely renamed. Their tags do nothing.
              </p>
              <ul className="space-y-1">
                {orphans.map((o) => (
                  <li key={o.account_name} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs">
                      {o.account_name}{" "}
                      <span className="text-muted-foreground">({o.classification})</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMut.mutate(o.account_name)}
                      disabled={removeMut.isPending}
                      title="Remove this stale tag"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
