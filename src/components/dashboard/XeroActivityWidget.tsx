import { DashboardCardHeader, CompactCardState } from "./DashboardCardHeader";
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
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="Xero file activity" icon={<UserCheck className="h-4 w-4"/>} description="Sign-in activity reported by Xero, updated overnight" status={<p className="mt-1.5 text-xs text-muted-foreground">{data?.fetchedAt ? `Figures pulled ${format(new Date(data.fetchedAt), "d MMM yyyy, h:mm a")}` : "Figures not available yet"}</p>}/>

      {query.isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : query.isError ? (
        <p className="mt-6 text-sm text-muted-foreground">Activity could not be loaded.</p>
      ) : !data?.available ? (
        <p className="mt-6 text-sm text-muted-foreground">No sign-in activity reported by Xero yet.</p>
      ) : data.users.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No sign-in activity reported by Xero yet.</p>
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
