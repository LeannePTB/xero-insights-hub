import { STATUS_LABEL, type CheckStatus, type HealthChecks } from "@/lib/health/health-checks";

const PILL: Record<CheckStatus, string> = {
  green: "border-success/30 bg-success/10 text-success",
  watch: "border-info/30 bg-info/10 text-info",
  red: "border-destructive/30 bg-destructive/10 text-destructive",
  na: "border-border bg-muted/40 text-muted-foreground",
};

/** Business Health in a monthly report. Only frozen payload strings. */
export function ReportHealthChecks({ checks }: { checks: HealthChecks }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business health</p>
      <h3 className="mt-2 font-display text-lg font-semibold">{checks.headline}</h3>
      <ul className="mt-3 space-y-2">
        {checks.checks.map((c) => (
          <li key={c.key} className="rounded-xl border border-border/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.question}</p>
                <p className="text-base font-semibold tabular-nums">{c.figure}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            </div>
            {c.detail && <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>}
            <p className="mt-1 text-sm text-muted-foreground">{c.meaning}</p>
          </li>
        ))}
      </ul>
      {checks.info.map((l) => <p key={l.key} className="mt-2 text-sm text-muted-foreground">{l.text}</p>)}
      <p className="mt-3 text-xs text-muted-foreground">Figures from Xero as saved on {checks.asOf} ({checks.fyLabel}).</p>
    </section>
  );
}
