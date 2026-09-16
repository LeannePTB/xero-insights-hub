import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock } from "lucide-react";
import { getClientOrgTrial } from "@/lib/subscription-state.functions";
import { formatEndDate } from "@/lib/subscription-state";

/**
 * Tells the people who use a client dashboard — including the business owner —
 * when the organisation is trialling the extra cards, and when that trial ends.
 * Deliberately calm: a trial ending is a reversion, not a failure, so this is
 * an informational note that only turns amber in the last fortnight.
 *
 * The server function returns null to anyone who may not see billing state
 * (external advisers, standing viewers, support grants), so this renders
 * nothing for them.
 */
export function ClientTrialNotice({ clientId }: { clientId: string }) {
  const fetchTrial = useServerFn(getClientOrgTrial);
  const q = useQuery({
    queryKey: ["client-org-trial", clientId],
    queryFn: () => fetchTrial({ data: { clientId } }),
    staleTime: 60_000,
  });

  const t = q.data?.trial;
  if (!t) return null;
  const date = formatEndDate(t.endsAt);

  const copy =
    t.daysRemaining === 0
      ? "Your trial of the full dashboard ends today. From tomorrow the standard dashboard remains."
      : `You're trialling the full dashboard${date ? ` — it ends on ${date}` : ""}. After that the standard dashboard remains, and the extra cards return if the organisation takes them up.`;

  return (
    <div
      className={
        t.endingSoon
          ? "mt-6 flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm"
          : "mt-6 flex items-start gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm"
      }
    >
      <Clock
        className={
          t.endingSoon
            ? "mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            : "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        }
      />
      <p>
        <span className="font-medium">
          {t.daysRemaining === 0 ? "Trial ends today." : "Trial access."}
        </span>{" "}
        <span className="text-muted-foreground">{copy}</span>
      </p>
    </div>
  );
}
