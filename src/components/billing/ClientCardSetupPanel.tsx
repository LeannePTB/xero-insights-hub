import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getClientCardSetup,
  setClientCardTick,
  copyClientCardSetup,
} from "@/lib/card-model.functions";
import { listClients } from "@/lib/clients.functions";
import { cardLabel, cardNotBuilt, CARD_GROUP_LABEL } from "@/lib/card-labels";

/**
 * Per-client card ticks under the purchase + ticked-list model.
 *
 * Only cards the organisation has bought are listed, grouped Standard /
 * Advisory / Consolidation from public.card_group_list(). Every write goes
 * through public.set_client_card_enabled, which checks the second factor and
 * write access to the client and records an audit row. Nothing is decided here.
 */
export function ClientCardSetupPanel({
  clientId,
  firmId,
}: {
  clientId: string;
  firmId?: string | null;
}) {
  const qc = useQueryClient();
  const fetchSetup = useServerFn(getClientCardSetup);
  const tick = useServerFn(setClientCardTick);
  const [busy, setBusy] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const q = useQuery({
    queryKey: ["client-card-setup", clientId],
    queryFn: () => fetchSetup({ data: { clientId } }),
    retry: false,
  });

  const visible = useMemo(
    () => new Set((q.data as any)?.visible ?? []),
    [(q.data as any)?.visible],
  );

  async function onToggle(card: string, next: boolean) {
    if (busy) return;
    setBusy(card);
    try {
      await tick({ data: { clientId, card, enabled: next } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["client-card-setup", clientId] }),
        qc.invalidateQueries({ queryKey: ["client-widgets", clientId] }),
        qc.invalidateQueries({ queryKey: ["effective-widgets", clientId] }),
        qc.invalidateQueries({ queryKey: ["client-widget-matrix", clientId] }),
      ]);
      toast.success(`${cardLabel(card)} switched ${next ? "on" : "off"} for this client.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not change this card");
    } finally {
      setBusy(null);
    }
  }

  if (q.isLoading) {
    return (
      <p className="text-xs text-muted-foreground">
        <Loader2 className="mr-2 inline h-3 w-3 animate-spin" /> Loading cards…
      </p>
    );
  }
  if (q.error || !q.data || (q.data as any).modelActive !== true) {
    return (
      <p className="text-xs text-muted-foreground">
        {(q.error as Error)?.message ?? "Card list not available for this client."}
      </p>
    );
  }

  const groups = ((q.data as any).groups ?? []) as { group: string; cards: string[] }[];
  const available = new Set(((q.data as any).available ?? []) as string[]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-xs text-muted-foreground">
          The cards this client's dashboard shows. Only cards the organisation has bought are listed
          — Advisory and Consolidation appear here once they are switched on for the organisation.
        </p>
        <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy to other clients
        </Button>
      </div>

      {groups
        .filter((g) => g.cards.some((c) => available.has(c)))
        .map((g) => (
          <div key={g.group}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {CARD_GROUP_LABEL[g.group] ?? g.group}
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {g.cards
                .filter((c) => available.has(c))
                .map((card) => (
                  <li key={card} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{cardLabel(card)}</p>
                      <p className="text-xs text-muted-foreground">
                        {visible.has(card) ? "On" : "Off for this client"}
                        {cardNotBuilt(card) && " · not built yet"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {busy === card && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      <Switch
                        checked={visible.has(card)}
                        disabled={busy !== null}
                        onCheckedChange={(v) => onToggle(card, v)}
                        aria-label={`${cardLabel(card)} for this client`}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}

      <CopyToClientsDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        clientId={clientId}
        firmId={firmId}
        onCopied={() => {
          qc.invalidateQueries({ queryKey: ["client-card-setup"] });
          qc.invalidateQueries({ queryKey: ["client-widgets"] });
        }}
      />
    </div>
  );
}

function CopyToClientsDialog({
  open,
  onOpenChange,
  clientId,
  firmId,
  onCopied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  firmId?: string | null;
  onCopied: () => void;
}) {
  const fetchClients = useServerFn(listClients);
  const copy = useServerFn(copyClientCardSetup);
  const [chosen, setChosen] = useState<string[]>([]);

  const q = useQuery({
    queryKey: ["clients-for-card-copy", firmId ?? "mine"],
    queryFn: () => fetchClients({ data: firmId ? { firmId } : {} }),
    enabled: open,
    retry: false,
  });

  const others = (((q.data as any)?.clients ?? []) as any[]).filter((c) => c.id !== clientId);

  const mut = useMutation({
    mutationFn: () => copy({ data: { fromClientId: clientId, toClientIds: chosen } }),
    onSuccess: (r: any) => {
      toast.success(
        `Card setup copied to ${r.copied} client${r.copied === 1 ? "" : "s"}.`,
      );
      setChosen([]);
      onOpenChange(false);
      onCopied();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not copy the card setup"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Copy this card setup</DialogTitle>
          <DialogDescription>
            Replaces the ticked cards on each client you choose with this client's. Only clients in
            the same organisation can be chosen, and each still shows only what the organisation has
            bought.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> Loading clients…
          </p>
        ) : others.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There are no other clients in this organisation.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChosen(others.map((c) => c.id))}
              >
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setChosen([])}>
                Clear
              </Button>
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {others.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm">
                    <Checkbox
                      checked={chosen.includes(c.id)}
                      onCheckedChange={() =>
                        setChosen((prev) =>
                          prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                        )
                      }
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={mut.isPending || chosen.length === 0}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Copy to {chosen.length || "…"} client{chosen.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
