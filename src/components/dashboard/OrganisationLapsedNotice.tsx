import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { getClientSubscriptionState } from "@/lib/subscription-state.functions";
import { formatEndDate } from "@/lib/subscription-state";

/**
 * Explains missing higher-tier cards when the organisation's subscription has
 * lapsed. Staff only — the server function returns nothing to client viewers.
 */
export function OrganisationLapsedNotice({ clientId }: { clientId: string }) {
  const fetchState = useServerFn(getClientSubscriptionState);
  const q = useQuery({
    queryKey: ["client-subscription-state", clientId],
    queryFn: () => fetchState({ data: { clientId } }),
    staleTime: 60_000,
  });

  const s = q.data?.state;
  if (!s || !s.lapsed) return null;
  const date = formatEndDate(s.endsAt);

  return (
    <div className="mt-6 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p>
        <span className="font-medium">Standard dashboard only.</span>{" "}
        <span className="text-muted-foreground">
          The organisation's subscription ended{date ? ` on ${date}` : ""}, so the higher-tier cards
          and consolidation tools are unavailable until it is renewed.
        </span>
      </p>
    </div>
  );
}
