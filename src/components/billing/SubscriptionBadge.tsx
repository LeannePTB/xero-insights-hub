import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientSubscription } from "@/lib/billing.functions";
import { Badge } from "@/components/ui/badge";

function daysFromNow(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SubscriptionBadge({ clientId }: { clientId: string }) {
  const fetchFn = useServerFn(getClientSubscription);
  const q = useQuery({
    queryKey: ["client-subscription", clientId],
    queryFn: () => fetchFn({ data: { clientId } }),
    staleTime: 60_000,
  });

  const sub = q.data?.subscription;
  if (!sub) {
    return (
      <div className="mt-3">
        <Badge variant="outline" className="text-[10px]">No billing</Badge>
      </div>
    );
  }

  const status = sub.status as string;
  const dueDate = formatDate(sub.current_period_end ?? sub.trial_end);
  let label = status;
  let className = "";
  let subText: string | null = dueDate ? `Due ${dueDate}` : null;

  switch (status) {
    case "active":
      label = "Active";
      className = "bg-emerald-100 text-emerald-800 border-emerald-200";
      break;
    case "trialing": {
      const days = daysFromNow(sub.trial_end);
      label = "Trial";
      className = "bg-sky-100 text-sky-800 border-sky-200";
      subText = days !== null ? `Trial ends in ${days} day${days === 1 ? "" : "s"}` : subText;
      break;
    }
    case "free_forever":
      label = "Free Forever";
      className = "bg-slate-200 text-slate-700 border-slate-300";
      subText = null;
      break;
    case "past_due":
      label = "Past Due";
      className = "bg-red-100 text-red-800 border-red-200";
      break;
    case "cancelled":
      label = "Cancelled";
      className = "bg-red-100 text-red-800 border-red-200";
      break;
  }

  return (
    <div className="mt-3 space-y-1">
      <Badge variant="outline" className={`text-[10px] ${className}`}>{label}</Badge>
      {subText && <div className="text-[10px] text-muted-foreground">{subText}</div>}
    </div>
  );
}
