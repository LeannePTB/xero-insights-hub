import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, RefreshCw, Loader2 } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getSecurityChecks, getOnlineUsers } from "@/lib/security-posture.functions";
import { isRealDisplayName } from "@/lib/profile-name";

const REFRESH_MS = 60_000;

export function relativeMinutes(iso: string | undefined): string {
  if (!iso) return "just now";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
}

export function OnlineChip({
  displayName,
  email,
  isSuperAdmin,
  hasMfa,
  lastSeenAt,
}: {
  displayName: string | null;
  email: string | null;
  isSuperAdmin: boolean;
  hasMfa: boolean;
  lastSeenAt: string;
}) {
  const Icon = hasMfa ? ShieldCheck : ShieldX;
  const hasName = isRealDisplayName(displayName);
  const label = hasName ? displayName.trim() : "Name not set";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]">
          <Icon className={`h-3 w-3 ${hasMfa ? "text-emerald-500" : "text-destructive"}`} />
          <span className={`max-w-[80px] truncate ${hasName ? "" : "text-muted-foreground"}`}>
            {label}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">
        <div className="text-xs">
          <div className={hasName ? "font-medium" : "font-medium text-muted-foreground"}>{label}</div>
          <div className="text-muted-foreground">{email ?? "Verified email unavailable"}</div>
          <div className="text-muted-foreground">
            {isSuperAdmin ? "Super admin" : "Member"}
          </div>
          <div className="text-muted-foreground">
            {hasMfa ? "Second factor verified" : "No second factor"}
          </div>
          <div className="text-muted-foreground">Last active {relativeMinutes(lastSeenAt)}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Compact live posture summary. Presentation only: both queries are served by
 * aal2 + super-admin database functions, so a non-super-admin simply gets an
 * error and the card renders nothing.
 */
export function SecurityStatusCard() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const checksFn = useServerFn(getSecurityChecks);
  const onlineFn = useServerFn(getOnlineUsers);

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

  const pill =
    status === "loading"
      ? "Checking…"
      : status === "action"
        ? "Action"
        : status === "warn"
          ? "Warn"
          : "All OK";

  const pillTone =
    status === "action"
      ? "bg-destructive text-destructive-foreground"
      : status === "warn"
        ? "bg-amber-500 text-white"
        : status === "ok"
          ? "bg-emerald-600 text-white"
          : "bg-muted text-muted-foreground";

  const onlineList = online.data ?? [];
  const counts = data
    ? `${data.ok} OK · ${data.warn} Warn · ${data.action} Action · ${onlineList.length} online`
    : "Running live checks…";

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
              <div className="font-medium">Security · {pill}</div>
              <div className="text-muted-foreground">{counts}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="mx-2 mt-1 rounded-lg border bg-sidebar-accent/40 p-3 text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
          <span className="truncate text-xs font-medium">Security</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${pillTone}`}>
            {pill}
          </span>
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

      <p className="mt-1 text-[11px] text-muted-foreground">{counts}</p>
      <p className="text-[11px] text-muted-foreground">
        Checked {relativeMinutes(data?.generatedAt)}
      </p>

      {onlineList.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {onlineList.slice(0, 6).map((u) => (
            <OnlineChip
              key={u.userId}
              displayName={u.displayName}
              email={u.email}
              isSuperAdmin={u.isSuperAdmin}
              hasMfa={u.hasMfa}
              lastSeenAt={u.lastSeenAt}
            />
          ))}
          {onlineList.length > 6 && (
            <Link
              to="/admin/security"
              className="text-[10px] underline text-muted-foreground hover:text-foreground self-center"
            >
              +{onlineList.length - 6} more
            </Link>
          )}
        </div>
      )}

      <Button asChild size="sm" variant="outline" className="mt-3 h-7 w-full text-[11px]">
        <Link to="/admin/security">View details</Link>
      </Button>
    </div>
  );
}
