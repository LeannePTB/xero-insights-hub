import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Layers } from "lucide-react";
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

function LoansLayout() {
  const { firmId } = Route.useParams();

  const entitlement = useFirmWidgets(firmId);
  const allowed = entitlement.can("loan_consolidation");


  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
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
            <div className="pt-6">
              <Outlet />
            </div>
          </>
        )}
      </main>

    </div>
  );
}
