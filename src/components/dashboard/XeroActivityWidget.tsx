import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Loader2, UserCheck } from "lucide-react";
import { getXeroUserActivity } from "@/lib/xero/user-activity.functions";

export function XeroActivityWidget({
  clientId,
  tenantId,
  tenantName,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
}) {
  const fetchActivity = useServerFn(getXeroUserActivity);
  const query = useQuery({
    queryKey: ["xero-user-activity", clientId, tenantId],
    queryFn: () => fetchActivity({ data: { clientId, tenantId } }),
    retry: false,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const data = query.data;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tenantName}</p>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <UserCheck className="h-4 w-4 text-emphasis" /> Xero file activity
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Who last signed in to this Xero file, as reported by Xero. Updated overnight.
          </p>
        </div>
      </div>

      {query.isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : query.isError ? (
        <p className="mt-6 text-sm text-muted-foreground">Activity could not be loaded.</p>
      ) : !data?.available ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Not available yet — reconnect this Xero file so it can share sign-in activity, then it appears after the
          next overnight refresh.
        </p>
      ) : data.users.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Xero reported no user activity for this file.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {data.users.map((u, i) => (
            <li key={`${u.name}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
              <span className="font-medium">{u.name}</span>
              <span className="text-muted-foreground">
                {u.lastLoginAt ? `Last signed in ${format(new Date(u.lastLoginAt), "d MMM yyyy")}` : "No sign-in recorded"}
                {u.loginsThisMonth !== null && ` · ${u.loginsThisMonth} sign-in${u.loginsThisMonth === 1 ? "" : "s"} this month`}
                {u.documentsCreated !== null && ` · ${u.documentsCreated} document${u.documentsCreated === 1 ? "" : "s"} created`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
