import { PANEL_STATUS_LABEL, PANEL_TITLE, type CheckStatus, type HealthCheck } from "@/lib/health/health-checks";

/** Owner-approved status tints for Business Health panels only. */
const PANEL: Record<CheckStatus, { box: string; pill: string; cell: string }> = {
  green: { box: "border-health-good bg-health-good-surface", pill: "border-health-good/40 bg-health-good-cell text-health-good", cell: "bg-health-good-cell" },
  watch: { box: "border-health-watch/60 bg-health-watch-surface", pill: "border-health-watch/30 bg-health-watch-cell text-health-watch", cell: "bg-health-watch-cell" },
  red: { box: "border-health-alert bg-health-alert-surface", pill: "border-health-alert/40 bg-health-alert-cell text-health-alert", cell: "bg-health-alert-cell" },
  na: { box: "border-border bg-card", pill: "border-border bg-muted text-muted-foreground", cell: "bg-muted" },
};

/** Three side-by-side panels (stack on mobile). Display only: every string comes from the check payload. */
export function HealthPanels({ checks }: { checks: HealthCheck[] }) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
      {checks.map((c) => {
        const tone = PANEL[c.status];
        const rows = c.rows ?? [{ label: c.question, value: c.figure }];
        const analysis = c.analysis ?? [c.detail, c.meaning].filter((x): x is string => !!x);
        return (
          <li key={c.key} className={`rounded-lg border p-3 ${tone.box}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-sm font-semibold text-foreground">{c.title ?? PANEL_TITLE[c.key]}</p>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone.pill}`}>{PANEL_STATUS_LABEL[c.status]}</span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <dl className="space-y-1.5">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-2">
                    <dt className="min-w-0 text-xs text-foreground">{r.label}</dt>
                    <dd className={`min-w-16 rounded px-2 py-0.5 text-right text-xs font-semibold tabular-nums text-foreground ${tone.cell}`}>{r.value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <p className="text-xs font-bold text-foreground">Analysis</p>
                {analysis.map((line) => <p key={line} className="mt-0.5 text-xs text-foreground/80">{line}</p>)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
