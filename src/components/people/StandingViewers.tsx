import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listStandingViewers,
  revokeStandingViewer,
  setStandingViewerTier,
  cancelViewerInvite,
  listViewerInvites,
} from "@/lib/viewers.functions";
import { ALL_TIERS, tierLabel } from "@/lib/tiers";
import type { DashboardTier } from "@/lib/tiers";

/** Standing ("all clients") grants, badged, with a one-click revoke. */
export function StandingViewers({
  firmId,
  firmName,
  clientCount,
  canManage,
}: {
  firmId: string;
  firmName: string;
  clientCount: number;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const fetchStanding = useServerFn(listStandingViewers);
  const fetchInvites = useServerFn(listViewerInvites);
  const setTier = useServerFn(setStandingViewerTier);
  const revoke = useServerFn(revokeStandingViewer);
  const cancelInvite = useServerFn(cancelViewerInvite);

  const q = useQuery({
    queryKey: ["standing-viewers", firmId],
    queryFn: () => fetchStanding({ data: { firmId } }),
  });
  const invitesQ = useQuery({
    queryKey: ["viewer-invites", firmId],
    queryFn: () => fetchInvites({ data: { firmId } }),
  });

  const [pendingRevoke, setPendingRevoke] = useState<{
    id: string;
    who: string;
  } | null>(null);

  const tierMut = useMutation({
    mutationFn: (v: { id: string; tier: DashboardTier }) => setTier({ data: v }),
    onSuccess: () => {
      toast.success("Level changed.");
      qc.invalidateQueries({ queryKey: ["standing-viewers", firmId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not change the level."),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Access to every client removed.");
      setPendingRevoke(null);
      qc.invalidateQueries({ queryKey: ["standing-viewers", firmId] });
      qc.invalidateQueries({ queryKey: ["client-access"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove access."),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelInvite({ data: { id } }),
    onSuccess: () => {
      toast.success("Invitation cancelled.");
      qc.invalidateQueries({ queryKey: ["viewer-invites", firmId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not cancel the invitation."),
  });

  const rows = q.data?.viewers ?? [];
  const invites = invitesQ.data?.invites ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">People who can see every client</h3>
        {q.isLoading ? (
          <Loader2 className="mt-3 h-4 w-4 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nobody yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {rows.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{v.displayName ?? v.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{v.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">All clients</Badge>
                  {canManage ? (
                    <Select
                      value={v.tier}
                      onValueChange={(t) =>
                        tierMut.mutate({ id: v.id, tier: t as DashboardTier })
                      }
                    >
                      <SelectTrigger className="h-8 w-[9rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_TIERS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {tierLabel(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{tierLabel(v.tier)}</Badge>
                  )}
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setPendingRevoke({ id: v.id, who: v.displayName ?? v.email ?? "This person" })
                      }
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {invites.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Viewer invitations waiting to be accepted</h3>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{i.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.scope === "all_clients"
                      ? "Every client"
                      : `${i.clientIds.length} client${i.clientIds.length === 1 ? "" : "s"}`}{" "}
                    · {tierLabel(i.tier)} · expires {new Date(i.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelMut.mutate(i.id)}
                    disabled={cancelMut.isPending}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AlertDialog
        open={pendingRevoke !== null}
        onOpenChange={(o) => !o && setPendingRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove access to every client?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevoke?.who} will lose access to all {clientCount} client
              {clientCount === 1 ? "" : "s"} in {firmName}, and to any client added later. Any access
              you gave them to a single client stays as it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep their access</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRevoke && revokeMut.mutate(pendingRevoke.id)}
              disabled={revokeMut.isPending}
            >
              Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
