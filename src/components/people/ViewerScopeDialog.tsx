import { useEffect, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listClientAccess } from "@/lib/clients.functions";
import { setViewerScope } from "@/lib/viewers.functions";

type Client = { id: string; name: string };

/**
 * Change a Viewer between "All clients" and "Selected clients". The ticked list
 * starts from the clients they can see today; the database applies the change
 * in one step and decides whether the caller may make it.
 */
export function ViewerScopeDialog({
  open,
  onOpenChange,
  firmId,
  userId,
  who,
  clients,
  currentScope,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  firmId: string;
  userId: string;
  who: string;
  clients: Client[];
  currentScope: "all_clients" | "selected";
}) {
  const qc = useQueryClient();
  const fetchAccess = useServerFn(listClientAccess);
  const save = useServerFn(setViewerScope);
  const [scope, setScope] = useState(currentScope);
  const [picked, setPicked] = useState<string[]>([]);

  const accessQs = useQueries({
    queries: clients.map((c) => ({
      queryKey: ["client-access", c.id],
      queryFn: () => fetchAccess({ data: { clientId: c.id } }),
      enabled: open,
    })),
  });
  const loaded = accessQs.every((q) => !q.isLoading);

  useEffect(() => {
    if (!open || !loaded) return;
    setScope(currentScope);
    const mine = clients
      .filter((c, i) =>
        ((accessQs[i]?.data as any)?.access ?? []).some(
          (a: any) => a.user_id === userId && a.relationship === "external_adviser",
        ),
      )
      .map((c) => c.id);
    setPicked(currentScope === "all_clients" ? clients.map((c) => c.id) : mine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loaded]);

  const mut = useMutation({
    mutationFn: () =>
      save({ data: { firmId, userId, scope, clientIds: scope === "selected" ? picked : [] } }),
    onSuccess: () => {
      toast.success(
        scope === "all_clients"
          ? `${who} now sees All clients.`
          : `${who} now sees ${picked.length} selected client${picked.length === 1 ? "" : "s"}.`,
      );
      qc.invalidateQueries({ queryKey: ["standing-viewers", firmId] });
      qc.invalidateQueries({ queryKey: ["client-access"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not change their access."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change {who}'s access</DialogTitle>
          <DialogDescription>
            A Viewer is always read-only. Choose which clients they see.
          </DialogDescription>
        </DialogHeader>
        {!loaded ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-3">
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="all_clients" id="vs-all" className="mt-1" />
                <Label htmlFor="vs-all" className="font-normal">
                  All clients (includes clients added later)
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="selected" id="vs-selected" className="mt-1" />
                <Label htmlFor="vs-selected" className="font-normal">
                  Selected clients
                </Label>
              </div>
            </RadioGroup>
            {scope === "selected" && (
              <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {clients.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`vs-${c.id}`}
                      checked={picked.includes(c.id)}
                      onCheckedChange={(v) =>
                        setPicked((p) => (v === true ? [...p, c.id] : p.filter((x) => x !== c.id)))
                      }
                    />
                    <Label htmlFor={`vs-${c.id}`} className="font-normal">
                      {c.name}
                    </Label>
                  </li>
                ))}
              </ul>
            )}
            {scope === "selected" && (
              <p className="text-xs text-muted-foreground">
                Clients you leave unticked are removed straight away.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!loaded || mut.isPending || (scope === "selected" && picked.length === 0)}
          >
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
