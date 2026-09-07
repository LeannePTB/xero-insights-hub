import type { ReportVerdict } from "@/lib/reports/monthly-report";

/**
 * Page one of the monthly management report. Shared by the report preview
 * (MonthlyReportPreview) and the client dashboard summary so the two never
 * drift apart.
 *
 * Reads only strings frozen into the payload at generation time — nothing
 * here re-words, re-ranks or re-computes anything. No score, no pillar score
 * and no grade appears here or anywhere else in the report.
 */
export function ReportVerdictPage({ verdict }: { verdict: ReportVerdict }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        This month
      </p>
      <h3 className="mt-2 font-display text-xl font-semibold">{verdict.headline}</h3>
      {verdict.detail ? <p className="mt-2 text-sm leading-relaxed">{verdict.detail}</p> : null}

      {verdict.findings.length > 1 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          {verdict.findings.slice(1).map((f) => (
            <li key={f.ruleId}>
              <span className="font-medium">{f.title}.</span>{" "}
              <span className="text-muted-foreground">
                {f.detail}
                {f.repetition ? ` ${f.repetition}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {verdict.comment && (
        <blockquote className="mt-4 border-l-2 border-primary/60 pl-4 text-sm leading-relaxed">
          {verdict.comment.body}
          <footer className="mt-1 text-xs text-muted-foreground">
            {verdict.comment.author}, Positive Traction
          </footer>
        </blockquote>
      )}

      <p className="mt-4 text-sm text-muted-foreground">{verdict.coverage}</p>
      <p className="mt-2 text-xs text-muted-foreground">{verdict.nonAdvice}</p>
      {verdict.nextStep ? <p className="mt-3 text-sm">{verdict.nextStep}</p> : null}
    </section>
  );
}
