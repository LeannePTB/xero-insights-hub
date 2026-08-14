import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  listOnboardCandidates,
  createClientsFromSelectedTenants,
} from "@/lib/xero/connections.functions";

/**
 * After an "Add client from Xero" authorisation, Xero returns every organisation
 * the login can reach. Confirm which ones should become client subscriptions.
 */
export function XeroOnboardPickerDialog({
  firmId,
  state,
  onDone,
}: {
  firmId: string;
  state: string;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listOnboardCandidates);
  const create = useServerFn(createClientsFromSelectedTenants);
  const [selected, setSelected] = useState<string[]>([]);

  const q = useQuery({
    queryKey: ["xero-onboard-candidates", firmId, state],
    queryFn: () => list({ data: { firmId, state } }),
  });

  useEffect(() => {
    if (!q.data) return;
    setSelected(
      q.data.candidates.filter((c) => c.isNew && c.available).map((c) => c.tenantId),
    );
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () => create({ data: { firmId, state, tenantIds: selected } }),
    onSuccess: (outcome) => {
      qc.invalidateQueries({ queryKey: ["clients", firmId] });
      const skipped = [...outcome.skippedAssigned, ...outcome.skippedLimit];
      if (outcome.created.length === 1 && skipped.length === 0) {
        onDone();
        navigate({
          to: "/clients/$clientId",
          params: { clientId: outcome.created[0].clientId },
        });
        return;
      }
      if (outcome.created.length === 0) {
        toast.error("No clients were created.");
      } else {
        toast.success(
          `Created ${outcome.created.length} client${outcome.created.length === 1 ? "" : "s"}: ${outcome.created
            .map((c) => c.name)
            .join(", ")}.${skipped.length ? ` Skipped: ${skipped.join(", ")}.` : ""}`,
        );
      }
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create the clients"),
  });

  const candidates = q.data?.candidates ?? [];
  const remaining = q.data?.remaining ?? 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Which Xero files should become clients?</DialogTitle>
          <DialogDescription>
            Xero returns every organisation your login can reach. Only the ones you tick will be
            created as client subscriptions in this organisation.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            That Xero selection has expired or returned nothing. Try Add client from Xero again.
          </p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {candidates.map((c) => {
              const checked = selected.includes(c.tenantId);
              const overLimit = !checked && selected.length >= remaining;
              const disabled = !c.available || overLimit;
              return (
                <label
                  key={c.tenantId}
                  className={`flex items-center gap-3 rounded-lg border border-border p-3 ${
                    disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(v) =>
                      setSelected((prev) =>
                        v ? [...prev, c.tenantId] : prev.filter((id) => id !== c.tenantId),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  {c.alreadyLinked ? (
                    <Badge variant="secondary">Already a client</Badge>
                  ) : c.isNew ? (
                    <Badge>Newly authorised</Badge>
                  ) : overLimit ? (
                    <Badge variant="outline">No room in plan</Badge>
                  ) : (
                    <Badge variant="outline">Previously authorised</Badge>
                  )}
                </label>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={selected.length === 0 || mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create {selected.length || ""} client{selected.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
