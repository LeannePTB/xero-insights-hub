import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LifeBuoy, Loader2, ShieldCheck, ChevronDown } from "lucide-react";
import { getSupportAccess, setSupportAccess } from "@/lib/support-access.functions";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * Lets the organisation owner allow (or revoke) platform support staff access
 * to the organisation's client financial data. Everyone else sees the state
 * read-only.
 */
export function SupportAccessCard({ firmId }: { firmId: string }) {
  const qc = useQueryClient();
  const fetchState = useServerFn(getSupportAccess);
  const save = useServerFn(setSupportAccess);

  const q = useQuery({
    queryKey: ["support-access", firmId],
    queryFn: () => fetchState({ data: { firmId } }),
  });

  const mut = useMutation({
    mutationFn: (granted: boolean) => save({ data: { firmId, granted } }),
    onSuccess: (r: any) => {
      toast.success(r?.granted ? "Support access granted" : "Support access revoked");
      qc.invalidateQueries({ queryKey: ["support-access", firmId] });
      qc.invalidateQueries({ queryKey: ["firm-audit", firmId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update support access"),
  });

  const s = q.data;
  const [open, setOpen] = useState(false);

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
              ) : s?.canManage ? (
                <Badge variant={s?.granted ? "default" : "secondary"}>
                  {s.granted ? "Granted" : "Not granted"}
                </Badge>
              ) : s?.viewerIsMember ? (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                  Access via membership
                </Badge>
              ) : (
                <Badge variant={s?.granted ? "default" : "secondary"}>
                  {s?.granted ? "Granted" : "Not granted"}
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
            Allow Traction Advisory support staff to view this organisation's client data. Staff
            who are members of this organisation always have access. Access stays on until you
            turn it off.
          </p>

          {s && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {s.viewerIsMember && !s.canManage ? (
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    You can open this organisation's client data because you're a member of it.
                  </span>
                ) : s.granted ? (
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Granted{s.grantedByName ? ` by ${s.grantedByName}` : ""}
                    {s.grantedAt ? ` on ${new Date(s.grantedAt).toLocaleString()}` : ""}
                  </span>
                ) : (
                  <span>
                    Support staff cannot open client dashboards, reports or figures for this organisation
                    {s.revokedAt ? ` (revoked ${new Date(s.revokedAt).toLocaleString()})` : ""}.
                  </span>
                )}
              </div>

              {s.canManage && (
                <div className="flex items-center gap-3">
                  <Switch
                    checked={!!s.granted}
                    disabled={mut.isPending}
                    onCheckedChange={(v) => mut.mutate(v)}
                    aria-label="Allow support access"
                  />
                  <span className="text-sm font-medium">{s.granted ? "On" : "Off"}</span>
                  {s.granted && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mut.isPending}
                      onClick={() => mut.mutate(false)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
