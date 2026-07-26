import { Badge } from "@/components/ui/badge";

export type ClientSubscription = {
  plan_name: string | null;
  subscription_type: "paid" | "free_forever" | "trial" | null;
  status: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  past_due_since: string | null;
} | null;

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function subscriptionView(sub: ClientSubscription) {
  // No row = no billing set up yet
  if (!sub) {
    return {
      label: "No billing",
      className: "bg-muted text-muted-foreground border-border",
      sub: null as string | null,
      plan: "—",
      due: "—",
    };
  }

  const dueIso = sub.current_period_end ?? sub.trial_end ?? null;
  const dueFormatted = formatDate(dueIso);
  const now = Date.now();
  const isExpired = dueIso ? new Date(dueIso).getTime() < now : false;

  // Free forever — no expiry
  if (sub.status === "free_forever" || sub.subscription_type === "free_forever") {
    return {
      label: "Free",
      className: "bg-slate-200 text-slate-700 border-slate-300",
      sub: null,
      plan: sub.plan_name ?? "Free Forever",
      due: "—",
    };
  }

  // Trial
  if (sub.status === "trialing" || sub.subscription_type === "trial") {
    const days = daysUntil(sub.trial_end ?? sub.current_period_end);
    return {
      label: "Trial",
      className: "bg-sky-100 text-sky-800 border-sky-200",
      sub: days !== null && days >= 0 ? `${days} day${days === 1 ? "" : "s"} left` : "Trial ended",
      plan: sub.plan_name ?? "Trial",
      due: dueFormatted ?? "—",
    };
  }

  // Past due / cancelled / expired dates
  if (sub.status === "past_due" || sub.status === "cancelled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
    return {
      label: sub.status === "past_due" ? "Overdue" : sub.status === "cancelled" ? "Cancelled" : "Expired",
      className: "bg-red-100 text-red-800 border-red-200",
      sub: dueFormatted ? `Was due ${dueFormatted}` : null,
      plan: sub.plan_name ?? "—",
      due: dueFormatted ?? "—",
    };
  }

  // Active (paid & current)
  if (sub.status === "active") {
    if (isExpired) {
      return {
        label: "Expired",
        className: "bg-red-100 text-red-800 border-red-200",
        sub: dueFormatted ? `Was due ${dueFormatted}` : null,
        plan: sub.plan_name ?? "—",
        due: dueFormatted ?? "—",
      };
    }
    return {
      label: "Active",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
      sub: dueFormatted ? `Renews ${dueFormatted}` : null,
      plan: sub.plan_name ?? "—",
      due: dueFormatted ?? "—",
    };
  }

  // Fallback for unknown statuses
  return {
    label: sub.status ?? "Unknown",
    className: "bg-muted text-muted-foreground border-border",
    sub: dueFormatted ? `Due ${dueFormatted}` : null,
    plan: sub.plan_name ?? "—",
    due: dueFormatted ?? "—",
  };
}

export function SubscriptionStatusBadge({ sub }: { sub: ClientSubscription }) {
  const v = subscriptionView(sub);
  return (
    <Badge variant="outline" className={`text-[11px] ${v.className}`}>
      {v.label}
    </Badge>
  );
}
