import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock } from "lucide-react";
import { getSubscriptionState } from "@/lib/subscription-state.functions";
import { consequenceCopy, countdownLabel, formatEndDate } from "@/lib/subscription-state";

/**
 * Loud banner on the organisation page when the plan is ending soon or has
 * already lapsed. Always-free organisations never see a date or a countdown.
 */
export function SubscriptionExpiryBanner({ firmId }: { firmId: string }) {
  const fetchState = useServerFn(getSubscriptionState);
  const q = useQuery({
    queryKey: ["subscription-state", firmId],
    queryFn: () => fetchState({ data: { firmId } }),
    staleTime: 60_000,
  });

  const s = q.data?.state;
  if (!s || s.alwaysFree) return null;
  if (!s.endingSoon && !s.lapsed) return null;

  const countdown = countdownLabel(s);
  const date = formatEndDate(s.endsAt);

  const tone = s.lapsed
    ? "border-destructive/50 bg-destructive/10"
    : "border-amber-500/50 bg-amber-500/10";
  const heading = s.lapsed
    ? "Subscription ended — clients are on the Standard dashboard"
    : s.status === "trialing"
      ? `Trial ends${date ? ` ${date}` : ""}${countdown ? ` · ${countdown}` : ""}`
      : `Subscription ends${date ? ` ${date}` : ""}${countdown ? ` · ${countdown}` : ""}`;

  return (
    <div className={`mb-6 flex items-start gap-3 rounded-lg border p-4 ${tone}`}>
      {s.lapsed ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      ) : (
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <div className="text-sm">
        <p className="font-semibold">{heading}</p>
        <p className="mt-1 text-muted-foreground">{consequenceCopy(s)}</p>
      </div>
    </div>
  );
}
