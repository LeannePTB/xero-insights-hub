import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getWipOverview } from "@/lib/admin.functions";
import { WIDGET_LABEL, type WidgetKey } from "@/lib/tiers";
import { InTestingBadge } from "@/components/dashboard/InTestingBadge";
import { SuperAdminChip } from "@/components/admin/SuperAdminOnly";

/**
 * Read-only: which widgets are in testing and which organisations have early
 * access. The list itself is edited in the database (plan_levels, scope
 * 'dashboard', key 'wip'); access is switched on per organisation from the
 * organisation's Subscription section.
 */
export function WipOverviewCard() {
  const fetchFn = useServerFn(getWipOverview);
  const q = useQuery({ queryKey: ["wip-overview"], queryFn: () => fetchFn(), retry: false });

  if (q.isLoading) {
    return (
      <section className="rounded-2xl border border-admin-accent/40 bg-admin-accent/5 p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading widgets in testing…
      </section>
    );
  }
  if (q.error || !q.data) return null;

  const { widgets, organisations, enabled } = q.data;

  return (
    <section className="rounded-2xl border border-admin-accent/40 bg-admin-accent/5 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-semibold">Widgets in testing</h2>
        <InTestingBadge />
        <SuperAdminChip />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        These cards are added on top of a client&apos;s normal tier for any organisation with early
        access switched on. Switch access on in the organisation&apos;s Subscription section; edit
        the list itself in the database.
      </p>
      {!enabled && (
        <p className="mt-2 text-sm text-destructive">
          The &quot;In testing&quot; level is disabled, so nothing is being added at the moment.
        </p>
      )}

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cards in testing
          </p>
          {widgets.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing is in testing right now.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {widgets.map((w) => (
                <li key={w}>{WIDGET_LABEL[w as WidgetKey] ?? w}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Organisations with early access
          </p>
          {organisations.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No organisation has early access at the moment.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {organisations.map((o) => (
                <li key={o.id}>{o.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
