import { STATUS_LABEL, type CheckStatus, type HealthChecks } from "@/lib/health/health-checks";

const PILL: Record<CheckStatus, string> = {
  green: "border-success/30 bg-success/10 text-success",
  watch: "border-info/30 bg-info/10 text-info",
  red: "border-destructive/30 bg-destructive/10 text-destructive",
  na: "border-border bg-muted/40 text-muted-foreground",
};

/** Light status tint for each check tile, mirroring the dashboard card. */
const TILE: Record<CheckStatus, string> = {
  green: "border-success/30 bg-success/5",
  watch: "border-info/30 bg-info/5",
  red: "border-destructive/30 bg-destructive/5",
  na: "border-border/60",
};

/** Business Health in a monthly report. Only frozen payload strings. */
export function ReportHealthChecks({ checks }: { checks: HealthChecks }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business health</p>
        <h3 className="font-display text-base font-semibold">{checks.headline}</h3>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {checks.checks.map((c) => (
          <li key={c.key} className={`rounded-xl border p-2.5 ${TILE[c.status]}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-medium">{c.question}</p>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            </div>
            <p className="text-base font-semibold tabular-nums">{c.figure}</p>
            {c.detail && <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{c.meaning}</p>
          </li>
        ))}
      </ul>
      {checks.info.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{checks.info.map((l) => l.text).join(" · ")}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Figures from Xero as saved on {checks.asOf} ({checks.fyLabel}).</p>
    </section>
  );
}
