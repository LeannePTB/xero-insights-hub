import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientWidgets } from "@/lib/tier-config.functions";
import { ALL_WIDGETS, WIDGET_LABEL, type WidgetKey } from "@/lib/tiers";
import { Loader2 } from "lucide-react";

/**
 * Read-only view of the cards this client sees. The list comes solely from
 * public.client_allowed_widgets — the per-client tick list is retired, because
 * a second stored list silently held clients on the Standard cards after a
 * tier change. Change what is shown via the dashboard tier and the tier's card
 * configuration.
 */
export function ClientWidgetsPanel({ clientId }: { clientId: string }) {
  const fetchWidgets = useServerFn(getClientWidgets);

  const q = useQuery({
    queryKey: ["client-widgets", clientId, "actual"],
    queryFn: () => fetchWidgets({ data: { clientId } }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (q.isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const allowed = new Set((q.data?.widgets ?? []) as WidgetKey[]);
  const planLabel = q.data?.planLabel ?? "";

  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">
        Cards this client sees, from their dashboard tier{planLabel ? ` (${planLabel})` : ""}.
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        To change them, change the dashboard tier or the tier's card configuration.
      </p>

      {allowed.size === 0 ? (
        <p className="text-sm text-muted-foreground">
          No cards are available for this client. Check the organisation's plan and the client's
          dashboard tier.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_WIDGETS.map((w) => (
            <div
              key={w}
              className={`flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm ${
                allowed.has(w) ? "" : "opacity-50"
              }`}
            >
              <span className="min-w-0 truncate">{WIDGET_LABEL[w]}</span>
              {!allowed.has(w) && (
                <span className="ml-auto text-xs text-muted-foreground">Not in this tier</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
