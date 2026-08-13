import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { saveClientConsolidation } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export function ConsolidationPanel({
  clientId,
  orgs,
  mode,
  selectedOrgIds,
}: {
  clientId: string;
  orgs: { id: string; tenantName: string; tenantId: string | undefined }[];
  mode: "individual" | "consolidated";
  selectedOrgIds: string[];
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveClientConsolidation);
  const [enabled, setEnabled] = useState(mode === "consolidated");
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedOrgIds));

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          clientId,
          mode: enabled ? "consolidated" : "individual",
          orgIds: enabled ? [...selected] : [],
        },
      }),
    onSuccess: () => {
      toast.success("Consolidation settings saved");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (orgs.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Link at least two Xero organisations to enable consolidation.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-sm font-semibold">Consolidated view</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Combine selected companies into one Accounts Receivable and Accounts Payable card. Intercompany loan balances are eliminated from the consolidated totals.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            id="consolidation-toggle"
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v);
              if (!v) setSelected(new Set());
            }}
          />
          <Label htmlFor="consolidation-toggle" className="text-xs text-muted-foreground">
            {enabled ? "On" : "Off"}
          </Label>
        </div>
      </div>

      {enabled && (
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Select companies to consolidate
          </p>
          <ul className="space-y-2">
            {orgs.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
                  <Checkbox
                    checked={selected.has(o.id)}
                    onCheckedChange={() => {
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(o.id)) next.delete(o.id);
                        else next.add(o.id);
                        return next;
                      });
                    }}
                  />
                  <span className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {o.tenantName}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {selected.size < 2 && (
            <p className="mt-3 text-xs text-amber-600">Select at least two companies to consolidate.</p>
          )}
        </div>
      )}

      <Button
        onClick={() => mut.mutate()}
        disabled={mut.isPending || (enabled && selected.size < 2)}
      >
        Save consolidation
      </Button>
    </div>
  );
}
