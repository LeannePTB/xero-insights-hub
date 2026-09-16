/**
 * Setup checklist on client settings. Display only: every status comes from the
 * server, and each flag links to the section that fixes it.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Check, HelpCircle, Loader2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getClientSetupChecklist,
  acknowledgeSetupItem,
} from "@/lib/setup-checklist.functions";
import type { SetupChecklist } from "@/lib/setup-checklist.server";

export function ClientSetupSection({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getClientSetupChecklist);
  const ackFn = useServerFn(acknowledgeSetupItem);

  const q = useQuery<SetupChecklist>({
    queryKey: ["client-setup", clientId],
    queryFn: () => fetchFn({ data: { clientId } }) as Promise<SetupChecklist>,
  });

  const ackMut = useMutation({
    mutationFn: (v: { item: any; choice: string }) =>
      ackFn({ data: { clientId, item: v.item, choice: v.choice } }),
    onSuccess: () => {
      toast.success("Recorded");
      qc.invalidateQueries({ queryKey: ["client-setup", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not record that"),
  });

  if (q.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking this client's setup…
      </p>
    );
  }
  if (q.error) {
    return <p className="text-sm text-destructive">{(q.error as any)?.message ?? "Could not read the setup checklist."}</p>;
  }

  const items = q.data?.items ?? [];
  const outstanding = q.data?.outstanding ?? 0;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {outstanding === 0
          ? "Everything on this list has an answer. A deliberate “not registered”, “off” or “not applicable” counts as an answer."
          : `${outstanding} item${outstanding === 1 ? "" : "s"} still need a decision. Nothing here breaks the dashboard, but an unanswered item can make figures quietly wrong.`}
      </p>

      <ul className="divide-y divide-border/60 rounded-xl border border-border">
        {items.map((item) => {
          const flagged = item.status === "needs_attention";
          return (
            <li key={item.key} className="flex items-start gap-3 p-4">
              <span className="mt-0.5 shrink-0">
                {flagged ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                ) : item.status === "done" ? (
                  <Check className="h-4 w-4 text-muted-foreground" />
                ) : item.status === "unknown" ? (
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{item.title}</span>
                  {flagged ? (
                    <span className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                      Needs a decision
                    </span>
                  ) : item.status === "not_applicable" ? (
                    <span className="text-[11px] text-muted-foreground">Not applicable</span>
                  ) : item.status === "unknown" ? (
                    <span className="text-[11px] text-muted-foreground">Cannot tell yet</span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Done</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Link
                    to="/clients/$clientId/settings"
                    params={{ clientId }}
                    hash={item.anchor}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Open the section that fixes this
                  </Link>
                  {item.acknowledge ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={ackMut.isPending}
                      onClick={() =>
                        ackMut.mutate({ item: item.key, choice: item.acknowledge!.choice })
                      }
                      title={item.acknowledge.note}
                    >
                      {item.acknowledge.label}
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
