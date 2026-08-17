import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";

/**
 * Loan Consolidation entry card for an organisation.
 * Links to the inter-company loan reconciliation workspace.
 */
export function LoanConsolidationCard({
  firmId,
  nested,
}: {
  firmId: string;
  nested?: boolean;
}) {
  const wrapperClass = nested
    ? "rounded-xl border border-border bg-background p-5"
    : "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]";

  return (
    <div className={wrapperClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-muted-foreground" /> Loan Consolidation
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Reconcile inter-company loan accounts across the organisation.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/firms/$firmId/loans" params={{ firmId }} search={{ group: undefined }}>
            Open
          </Link>
        </Button>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          View balances, pairings, and mismatch details for group loans.
        </p>
        <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
          <Link to="/firms/$firmId/loans" params={{ firmId }} search={{ group: undefined }}>
            Go to loan consolidation <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
