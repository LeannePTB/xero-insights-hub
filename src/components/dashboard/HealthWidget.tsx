import { Activity } from "lucide-react";

export function HealthWidget({ tenantName }: { tenantName?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          {tenantName && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tenantName}
            </p>
          )}
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Business Health
          </h3>
          <p className="text-xs text-muted-foreground">
            Coming soon — composite health score across cash, profitability and obligations.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Placeholder
        </span>
      </div>

      <div className="mt-6 grid place-items-center rounded-lg border border-dashed border-border bg-background/60 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          A unified score and signals view will appear here.
        </p>
      </div>
    </div>
  );
}
