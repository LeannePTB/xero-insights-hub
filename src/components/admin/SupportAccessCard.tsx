import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LifeBuoy, Loader2, ShieldCheck, ChevronDown, Clock } from "lucide-react";
import {
  getSupportAccess,
  requestSupportAccess,
  decideSupportAccess,
  type SupportGrant,
} from "@/lib/support-access.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePersistedDisclosure, sectionStorageKey } from "@/hooks/usePersistedDisclosure";

const STATUS_LABEL: Record<SupportGrant["status"], string> = {
  pending: "Awaiting approval",
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

/**
 * Support access is granted to ONE named staff member, is read-only, and
 * expires automatically within 72 hours. Only the organisation owner can
 * approve a request; platform staff can only ask.
 */
export function SupportAccessCard({ firmId }: { firmId: string }) {
  const qc = useQueryClient();
  const fetchState = useServerFn(getSupportAccess);
  const request = useServerFn(requestSupportAccess);
  const decide = useServerFn(decideSupportAccess);

  const q = useQuery({
    queryKey: ["support-access", firmId],
    queryFn: () => fetchState({ data: { firmId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["support-access", firmId] });
    qc.invalidateQueries({ queryKey: ["firm-audit", firmId] });
  };

  const requestMut = useMutation({
    mutationFn: () => request({ data: { firmId } }),
    onSuccess: () => {
      toast.success("Support access requested — the organisation owner must approve it");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not request support access"),
  });

  const decideMut = useMutation({
    mutationFn: (v: { grantId: string; approve: boolean }) => decide({ data: v }),
    onSuccess: (r: any) => {
      toast.success(r?.granted ? "Support access approved" : "Support access revoked");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update support access"),
  });

  const s = q.data;
  const [open, setOpen] = usePersistedDisclosure(sectionStorageKey("admin-organisation", "Support access"));
  const busy = requestMut.isPending || decideMut.isPending;
  const visible = (s?.grants ?? []).filter((g) => g.status === "pending" || g.status === "active");

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <CollapsibleTrigger asChild>
        <button className="w-full p-4 text-left outline-none">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <LifeBuoy className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Support access</h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {q.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : s?.viewerIsMember && !s?.canManage ? (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                  Access via membership
                </Badge>
              ) : (
                <Badge variant={s?.granted ? "default" : "secondary"}>
                  {s?.granted ? "Active grant" : "No active grant"}
                </Badge>
              )}
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-border px-4 pb-4 pt-2">
          <p className="max-w-xl text-sm text-muted-foreground">
            Support access lets one named Traction Advisory staff member view this organisation's
            client data, read-only. It has to be requested by that person and approved by you, and
            it expires automatically within 72 hours. You can revoke it at any time. Staff who are
            members of this organisation always have access and don't need a grant.
          </p>

          {s && (
            <div className="mt-4 space-y-3">
              {s.viewerIsMember && !s.canManage && (
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  You can open this organisation's client data because you're a member of it.
                </p>
              )}

              {visible.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No support access requests. Support staff cannot open client dashboards, reports
                  or figures for this organisation.
                </p>
              )}

              {visible.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      {g.granteeName ?? "Traction Advisory staff"}
                      {g.isMine ? " (you)" : ""}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={g.status === "active" ? "default" : "secondary"}>
                        {STATUS_LABEL[g.status]}
                      </Badge>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Expires {new Date(g.expiresAt).toLocaleString()}
                      </span>
                      {g.status === "active" && g.grantedByName && (
                        <span>Approved by {g.grantedByName}</span>
                      )}
                      {g.reason && <span>“{g.reason}”</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {s.canManage && g.status === "pending" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => decideMut.mutate({ grantId: g.id, approve: true })}
                      >
                        Approve
                      </Button>
                    )}
                    {(s.canManage || g.isMine) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => decideMut.mutate({ grantId: g.id, approve: false })}
                      >
                        {g.status === "pending" ? "Deny" : "Revoke"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {s.canRequest && (
                <Button size="sm" disabled={busy} onClick={() => requestMut.mutate()}>
                  {requestMut.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Request support access
                </Button>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
