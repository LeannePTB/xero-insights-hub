import { Layers } from "lucide-react";
import { LoanConsolidationCard } from "@/components/admin/LoanConsolidationCard";

/**
 * Company Consolidations hub for an organisation.
 * Nests consolidation tools such as loan consolidation.
 */
export function CompanyConsolidationsCard({ firmId }: { firmId: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4 text-muted-foreground" /> Company Consolidations
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Consolidation tools for this organisation.
      </p>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Consolidation tools
        </p>
        <div className="mt-3">
          <LoanConsolidationCard firmId={firmId} nested />
        </div>
      </div>
    </div>
  );
}

