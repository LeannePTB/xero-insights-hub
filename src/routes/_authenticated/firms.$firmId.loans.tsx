import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listConsolidationGroups } from "@/lib/consolidation-groups.functions";
import { useFirmWidgets } from "@/hooks/useFirmWidget";

export const Route = createFileRoute("/_authenticated/firms/$firmId/loans")({
  validateSearch: (search: Record<string, unknown>) => ({
    group: typeof search['group'] === "string" ? (search['group'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Company Loan Consolidation — Traction Advisory" },
      {
        name: "description",
        content: "Reconcile intercompany loan accounts across the Xero files in a consolidation group.",
      },
      { property: "og:title", content: "Company Loan Consolidation — Traction Advisory" },
      {
        property: "og:description",
        content: "Reconcile intercompany loan accounts across the Xero files in a consolidation group.",
      },
    ],
  }),
  component: LoansLayout,
});

const TABS = [
  { to: "/firms/$firmId/loans", label: "Matrix", exact: true },
  { to: "/firms/$firmId/loans/groups", label: "Groups", exact: false },
  { to: "/firms/$firmId/loans/accounts", label: "Accounts", exact: false },
] as const;

function LoansLayout() {
  const { firmId } = Route.useParams();
  const { group } = Route.useSearch();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const entitlement = useFirmWidgets(firmId);
  const allowed = entitlement.can("loan_consolidation");

  const fetchGroups = useServerFn(listConsolidationGroups);
  const groupsQ = useQuery({
    queryKey: ["consolidation-groups", firmId],
    queryFn: () => fetchGroups({ data: { firmId } }),
  });
  const groups = groupsQ.data?.groups ?? [];
  const selected = group ?? groups[0]?.id;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/firms/$firmId" params={{ firmId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to organisation
          </Link>
        </Button>

        <h1 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.15em] text-primary">
          <Layers className="h-4 w-4" /> Company Loan Consolidation
        </h1>

        {entitlement.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : !allowed ? (
          <p className="mt-6 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Loan consolidation is not part of this organisation's plan.
          </p>
        ) : (
          <>
            <nav className="mt-6 flex gap-1 border-b border-border">
              {TABS.map((t) => {
                const active = t.exact ? pathname.endsWith("/loans") : pathname.startsWith(`/firms/${firmId}${t.to.replace("/firms/$firmId", "")}`);
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    params={{ firmId }}
                    search={{ group: selected }}
                    className={`-mb-px border-b-2 px-4 py-2 text-sm ${
                      active
                        ? "border-primary font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>

            <div className="pt-6">
              <Outlet />
            </div>
          </>
        )}
      </main>

    </div>
  );
}
