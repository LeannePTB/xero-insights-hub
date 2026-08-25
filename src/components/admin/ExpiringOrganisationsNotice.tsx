import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listExpiringOrganisations } from "@/lib/subscription-state.functions";
import { countdownLabel, formatEndDate } from "@/lib/subscription-state";

/**
 * Staff-facing roll-up of organisations whose plan is ending soon or has
 * lapsed, so nobody has to open each organisation to find out.
 */
export function ExpiringOrganisationsNotice() {
  const fetchExpiring = useServerFn(listExpiringOrganisations);
  const q = useQuery({
    queryKey: ["expiring-organisations"],
    queryFn: () => fetchExpiring(),
    staleTime: 60_000,
  });

  const rows = q.data?.organisations ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">
            {rows.length} organisation{rows.length === 1 ? "" : "s"} need attention
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When a plan ends, that organisation's clients move to the Standard dashboard and the
            consolidation tools switch off.
          </p>
          <ul className="mt-3 space-y-2">
            {rows.map((o) => {
              const date = formatEndDate(o.endsAt);
              const countdown = countdownLabel(o);
              return (
                <li
                  key={o.firmId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{o.name}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {o.lapsed
                        ? `Lapsed — clients on Standard${date ? ` since ${date}` : ""}`
                        : `${o.planLabel ?? "Plan"} ends${date ? ` ${date}` : ""}${countdown ? ` · ${countdown}` : ""}`}
                    </span>
                  </span>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/admin/firms/$firmId" params={{ firmId: o.firmId }}>
                      Open
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
