import type { HealthChecks } from "@/lib/health/health-checks";
import { HealthPanels } from "@/components/dashboard/HealthPanels";

/** Business Health in a monthly report. Only frozen payload strings. */
export function ReportHealthChecks({ checks }: { checks: HealthChecks }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business health</p>
        <h3 className="font-display text-base font-semibold">{checks.headline}</h3>
      </div>
      <HealthPanels checks={checks.checks} />
      {checks.info.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{checks.info.map((l) => l.text).join(" · ")}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Figures from Xero as saved on {checks.asOf} ({checks.fyLabel}).</p>
    </section>
  );
}
