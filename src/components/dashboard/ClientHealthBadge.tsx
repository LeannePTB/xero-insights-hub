import { AlertCircle, AlertTriangle, CheckCircle2, CircleSlash, Info } from "lucide-react";
import type { Verdict } from "@/lib/health/verdicts.functions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The internal client-list verdict badge. Staff-only: it is rendered on the
 * organisation client list and nowhere client-facing.
 *
 * The composite health score is gone. This shows the single highest-ranked
 * rule, with the rest in the tooltip. A client whose data is stale, partial,
 * disconnected or unreadable can never render green.
 *
 * The verdict is passed in — the list fetches every client's verdict in one
 * query, so this component makes no request of its own.
 */

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300",
  warning: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300",
  watch: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300",
};

const OK_STYLE =
  "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300";
const MUTED_STYLE = "border-dashed border-border bg-muted/30 text-muted-foreground";

export function ClientHealthBadge({ verdict }: { verdict: Verdict | undefined }) {
  if (!verdict) {
    return <Badge style={MUTED_STYLE} icon={<CircleSlash className="h-3 w-3" />} label="Loading…" tip="Checking the most recent snapshot." />;
  }

  if (verdict.state === "ok") {
    return <Badge style={OK_STYLE} icon={<CheckCircle2 className="h-3 w-3" />} label={verdict.label} tip={verdict.detail} />;
  }

  if (verdict.state === "issues") {
    const style = SEVERITY_STYLES[verdict.severity] ?? SEVERITY_STYLES.watch;
    const icon =
      verdict.severity === "critical" ? <AlertCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />;
    const tip = (
      <ol className="space-y-1.5">
        {verdict.findings.map((f) => (
          <li key={f.ruleId}>
            <span className="font-medium">{f.title}</span>
            <span className="block opacity-80">{f.detail}</span>
          </li>
        ))}
      </ol>
    );
    return (
      <Badge
        style={style}
        icon={icon}
        label={verdict.label}
        suffix={verdict.more > 0 ? `+${verdict.more} more` : undefined}
        tip={tip}
      />
    );
  }

  return <Badge style={MUTED_STYLE} icon={<Info className="h-3 w-3" />} label={verdict.label} tip={verdict.detail} />;
}

function Badge({
  style,
  icon,
  label,
  suffix,
  tip,
}: {
  style: string;
  icon: React.ReactNode;
  label: string;
  suffix?: string;
  tip: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`mt-3 inline-flex max-w-full cursor-help items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${style}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {icon}
            <span className="truncate font-medium">{label}</span>
            {suffix && <span className="shrink-0 opacity-70">· {suffix}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
