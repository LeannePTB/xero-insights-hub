import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshXeroSnapshots } from "@/lib/xero/snapshot-refresh.functions";

const COOLDOWN_MS = 2 * 60 * 1000;

/**
 * One refresh control per dashboard, not per widget.
 *
 * The throttle is enforced server-side, per tenant (MANUAL_REFRESH_MAX,
 * TENANT_RUN_MAX). Disabling the button here is a courtesy only — a rejected
 * request never reaches Xero. The button stays visible while cooling down so
 * nobody concludes the feature vanished.
 */
export function RefreshSnapshotsButton({ tenantIds }: { tenantIds: string[] }) {
  const refresh = useServerFn(refreshXeroSnapshots);
  const qc = useQueryClient();
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);

  const mut = useMutation({
    mutationFn: async () => {
      let succeeded = 0;
      let throttled = false;
      for (const tenantId of tenantIds) {
        try {
          await refresh({ data: { tenantId } });
          succeeded += 1;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (/too many requests/i.test(message)) {
            throttled = true;
            break;
          }
          throw e;
        }
      }
      return { succeeded, throttled };
    },
    onSuccess: ({ succeeded, throttled }) => {
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      if (throttled && succeeded === 0) {
        // Shared per-tenant budget: two staff on the same client share it, so
        // this is never worded as the user's fault and never a red error.
        toast("These figures were refreshed a moment ago — you can refresh again in a couple of minutes.");
        return;
      }
      // Figures on screen are never cleared; the widgets simply re-read.
      qc.invalidateQueries();
      toast.success(
        throttled
          ? `Figures updated for ${succeeded} Xero ${succeeded === 1 ? "organisation" : "organisations"}. The rest were refreshed a moment ago.`
          : "Figures updated.",
      );
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not refresh figures.");
    },
  });

  const coolingDown = Date.now() < cooldownUntil;
  const disabled = mut.isPending || coolingDown || tenantIds.length === 0;

  return (
    <Button
      variant="outline"
      onClick={() => mut.mutate()}
      disabled={disabled}
      title={
        coolingDown
          ? "Refreshed a moment ago — available again in a couple of minutes."
          : "Refresh these figures from Xero"
      }
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${mut.isPending ? "animate-spin" : ""}`} />
      {mut.isPending ? "Refreshing from Xero…" : "Refresh figures"}
    </Button>
  );
}
