import type { ReactNode } from 'react';
import { CardFreshness } from './CardFreshness';
import { useCardTitle } from './card-title-context';
import type { SnapshotSource } from '@/lib/xero/snapshot-source';

export function DashboardCardHeader({ label, title, icon, description, source, isFetching, from, to, actions, badge, status, stackActions }: {
  label: string; title: string; icon: ReactNode; description: ReactNode;
  source?: SnapshotSource | null; isFetching?: boolean; from?: string | Date | null; to?: string | Date | null;
  actions?: ReactNode; badge?: ReactNode; status?: ReactNode;
  /** Actions drop under the title on narrow screens (wide controls). */
  stackActions?: boolean;
}) {
  // The catalogue name wins, so a System Admin rename shows everywhere.
  title = useCardTitle(title);
  return <header className={`mb-3 grid min-w-0 items-start gap-3 pr-9 ${stackActions ? "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]"}`} data-dashboard-card-header>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-muted-foreground break-words">{label}</p>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="flex min-w-0 items-start gap-2 font-display text-base font-semibold"><span className="mt-0.5 shrink-0 text-emphasis">{icon}</span><span className="min-w-0 break-words">{title}</span></h3>{badge}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      {status ?? <CardFreshness className="mt-1.5" source={source} isFetching={isFetching} from={from} to={to}/>}
    </div>
    {actions && <div className={`flex shrink-0 gap-1 ${stackActions ? "flex-row flex-wrap items-center sm:justify-end" : "flex-col items-end sm:flex-row sm:flex-wrap"}`}>{actions}</div>}
  </header>;
}

export function CompactCardState({ label, title, icon, summary, explanation, source, isFetching, actions }: {
  label: string; title: string; icon: ReactNode; summary: string; explanation: ReactNode;
  source?: SnapshotSource | null; isFetching?: boolean; actions?: ReactNode;
}) {
  return <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
    <DashboardCardHeader label={label} title={title} icon={icon} description={summary} source={source} isFetching={isFetching} actions={actions}/>
    <details className="text-xs text-muted-foreground"><summary className="w-fit cursor-pointer font-medium text-link">Why?</summary><div className="mt-2 leading-relaxed">{explanation}</div></details>
  </div>;
}