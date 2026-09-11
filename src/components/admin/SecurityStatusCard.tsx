import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shield, ShieldAlert, ShieldCheck, RefreshCw, Loader2 } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getSecurityChecks,
  getOnlineUsers,
  recordPresence,
} from "@/lib/security-posture.functions";

const REFRESH_MS = 60_000;

export function SecurityStatusCard() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const checksFn = useServerFn(getSecurityChecks);
  const onlineFn = useServerFn(getOnlineUsers);
  const presenceFn = useServerFn(recordPresence);

  const posture = useQuery({
    queryKey: ["security-checks"],
    queryFn: () => checksFn(),
    refetchInterval: REFRESH_MS,
    retry: false,
  });

  const online = useQuery({
    queryKey: ["online-users"],
    queryFn: () => onlineFn(),
    refetchInterval: REFRESH_MS,
    retry: false,
    enabled: !posture.isError,
  });

  useEffect(() => {
    if (posture.isError) return;
    void presenceFn({});
    const t = setInterval(() => void presenceFn({}), REFRESH_MS);
    return () => clearInterval(t);
  }, [presenceFn, posture.isError]);

  // Not a super admin (or not permitted): show nothing at all.
  if (posture.isError) return null;

  const data = posture.data;
  const status = !data ? "loading" : data.action > 0 ? "action" : data.warn > 0 ? "warn" : "ok";

  const Icon = status === "action" ? ShieldAlert : status === "ok" ? ShieldCheck : Shield;
  const tone =
    status === "action"
      ? "text-destructive"
      : status === "warn"
        ? "text-amber-500"
        : status === "ok"
          ? "text-emerald-500"
          : "text-muted-foreground";

  const label =
    status === "loading"
      ? "Checking…"
      : status === "action"
        ? "Action needed"
        : status === "warn"
          ? "Review"
          : "All clear";

  const summary = data
    ? `${data.ok} pass · ${data.warn} review · ${data.action} action`
    : "Running live checks…";

  const onlineList = online.data ?? [];

  if (collapsed) {
    return (
      <div className="px-1 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to="/admin/security" className="flex justify-center py-1">
              <Icon className={`h-5 w-5 ${tone}`} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">
            <div className="text-xs">
              <div className="font-medium">Security · {label}</div>
              <div className="text-muted-foreground">{summary}</div>
              <div className="text-muted-foreground">{onlineList.length} online now</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="mx-2 mb-2 rounded-lg border bg-sidebar-accent/40 p-3 text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
          <span className="truncate text-xs font-medium">Security · {label}</span>
        </div>
        <button
          type="button"
          aria-label="Re-run security checks"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            void posture.refetch();
            void online.refetch();
          }}
        >
          {posture.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <p className="mt-1 text-[11px] text-muted-foreground">{summary}</p>

      {onlineList.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {onlineList.slice(0, 4).map((u) => (
            <Tooltip key={u.userId}>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${u.hasMfa ? "bg-emerald-500" : "bg-amber-500"}`}
                  />
                  <span className="max-w-[80px] truncate">{u.name}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="text-xs">
                  {u.name}
                  {u.isSuperAdmin ? " · super admin" : ""}
                  <div className="text-muted-foreground">
                    {u.hasMfa ? "Second factor verified" : "No second factor"}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
          {onlineList.length > 4 && (
            <span className="text-[10px] text-muted-foreground">+{onlineList.length - 4}</span>
          )}
        </div>
      )}

      <Link
        to="/admin/security"
        className="mt-2 inline-block text-[11px] underline text-muted-foreground hover:text-foreground"
      >
        Details
      </Link>
    </div>
  );
}
