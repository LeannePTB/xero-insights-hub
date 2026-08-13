import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Building2, Layers, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getConsolidationGroup } from "@/lib/consolidation-groups.functions";
import {
  ConsolidatedReceivablesWidget,
  ConsolidatedPayablesWidget,
} from "@/components/dashboard/ConsolidatedAgeingWidget";
import { LoanConsolidationWidget } from "@/components/dashboard/LoanConsolidationWidget";

export const Route = createFileRoute("/_authenticated/firms/$firmId/consolidated/$groupId")({
  head: () => ({
    meta: [
      { title: "Consolidated view — Traction Advisory" },
      {
        name: "description",
        content: "Combined receivables, payables and intercompany loans across the companies in this group.",
      },
      { property: "og:title", content: "Consolidated view — Traction Advisory" },
      {
        property: "og:description",
        content: "Combined receivables, payables and intercompany loans across the companies in this group.",
      },
    ],
  }),
  component: ConsolidatedGroupPage,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ConsolidatedGroupPage() {
  const { firmId, groupId } = Route.useParams();
  const fetchGroup = useServerFn(getConsolidationGroup);
  const asAt = todayISO();

  const q = useQuery({
    queryKey: ["consolidation-group", groupId],
    queryFn: () => fetchGroup({ data: { groupId } }),
  });
  const group = q.data;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/firms/$firmId" params={{ firmId }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to organisation
          </Link>
        </Button>
      </div>

      {q.isLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading group…
        </p>
      )}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      {group && (
        <>
          <header>
            <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> {group.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {group.clients.map((c) => (
                <span key={c.clientId} className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {c.clientName}
                </span>
              ))}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Figures are accrual and consolidated as at {asAt}. Intercompany balances are eliminated from the totals.
            </p>
          </header>

          {!group.canSeeFigures ? (
            <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              You can manage this group's setup, but client financial figures are hidden for your role.
            </p>
          ) : (
            <>
              <ConsolidatedReceivablesWidget groupId={groupId} asAt={asAt} />
              <ConsolidatedPayablesWidget groupId={groupId} asAt={asAt} />

              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-display text-lg font-semibold">Loan consolidation</h2>
                </div>
                {group.clients.map((c) =>
                  c.orgs.map((o) => (
                    <div key={o.tenantId} className="space-y-2">
                      <LoanConsolidationWidget
                        clientId={c.clientId}
                        tenantId={o.tenantId}
                        tenantName={o.tenantName}
                      />
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/clients/$clientId/loans-accounts" params={{ clientId: c.clientId }}>
                          <Settings className="mr-2 h-3 w-3" /> Loan accounts for {c.clientName}
                        </Link>
                      </Button>
                    </div>
                  )),
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
