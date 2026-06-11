import { Link } from "@tanstack/react-router";
import { ArrowRight, HandCoins } from "lucide-react";

export function ReceivablesWidget({ tenantId, tenantName, clientId }: { tenantId: string; tenantName: string; clientId: string; loadDelayMs?: number }) {

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-primary" /> Accounts Receivable Ageing
          </h3>
          <p className="text-xs text-muted-foreground">
            Customer invoices are loaded on the detail page.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-border bg-background p-5">
        <p className="text-sm text-muted-foreground">
          Opening this page fetches receivables by itself, keeping the main dashboard fast.
        </p>
        <Link
          to="/clients/$clientId/receivables/$tenantId"
          params={{ clientId, tenantId }}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View receivables <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
