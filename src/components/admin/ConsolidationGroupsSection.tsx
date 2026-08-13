import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listConsolidationGroups,
  saveConsolidationGroup,
  deleteConsolidationGroup,
  type ConsolidationGroup,
} from "@/lib/consolidation-groups.functions";

export function ConsolidationGroupsSection({ firmId }: { firmId: string }) {
  const qc = useQueryClient();
  const fetchGroups = useServerFn(listConsolidationGroups);
  const saveGroup = useServerFn(saveConsolidationGroup);
  const removeGroup = useServerFn(deleteConsolidationGroup);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConsolidationGroup | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["consolidation-groups", firmId],
    queryFn: () => fetchGroups({ data: { firmId } }),
  });
  const view = q.data;

  function openNew() {
    setEditing(null);
    setName("");
    setSelected(new Set());
    setOpen(true);
  }

  function openEdit(group: ConsolidationGroup) {
    setEditing(group);
    setName(group.name);
    setSelected(new Set(group.clients.map((c) => c.clientId)));
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: () =>
      saveGroup({
        data: { firmId, groupId: editing?.id, name, clientIds: [...selected] },
      }),
    onSuccess: () => {
      toast.success(editing ? "Group updated" : "Group created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["consolidation-groups", firmId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (groupId: string) => removeGroup({ data: { groupId } }),
    onSuccess: () => {
      toast.success("Group deleted");
      qc.invalidateQueries({ queryKey: ["consolidation-groups", firmId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Consolidation groups
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Combine selected companies into one consolidated view. Intercompany loan balances are eliminated using the
            loan pairings already set up on each company.
          </p>
        </div>
        {view?.multiCompany && (
          <Button size="sm" onClick={openNew} disabled={(view?.clients.length ?? 0) < 2}>
            <Plus className="mr-2 h-4 w-4" /> New group
          </Button>
        )}
      </div>

      <div className="mt-5">
        {q.isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading groups…
          </p>
        )}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

        {view && !view.multiCompany && (
          <p className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
            Consolidation is part of the multi-company plan. Upgrade this organisation's plan to combine companies.
          </p>
        )}

        {view?.multiCompany && view.groups.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
            No consolidation groups yet. Create one and tick the companies to combine.
          </p>
        )}

        {view?.multiCompany && view.groups.length > 0 && (
          <ul className="space-y-3">
            {view.groups.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-background p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{g.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {g.clients.map((c) => (
                      <span key={c.clientId} className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {c.clientName}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild size="sm">
                    <Link
                      to="/firms/$firmId/consolidated/$groupId"
                      params={{ firmId, groupId: g.id }}
                    >
                      Open
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(g)}>
                    <Pencil className="mr-2 h-3 w-3" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete "${g.name}"?`)) del.mutate(g.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit consolidation group" : "New consolidation group"}</DialogTitle>
            <DialogDescription>
              Tick the companies to combine. A company can only belong to one group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Group name
              </label>
              <Input
                className="mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Trading group"
              />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border p-2">
              <ul className="space-y-1">
                {(view?.clients ?? []).map((c) => {
                  const inOtherGroup = c.groupId && c.groupId !== editing?.id;
                  const disabled = !c.hasXero || Boolean(inOtherGroup);
                  return (
                    <li key={c.clientId}>
                      <label
                        className={`flex items-center gap-3 rounded-md px-2 py-2 ${
                          disabled ? "opacity-50" : "cursor-pointer hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={selected.has(c.clientId)}
                          disabled={disabled}
                          onCheckedChange={() =>
                            setSelected((cur) => {
                              const next = new Set(cur);
                              if (next.has(c.clientId)) next.delete(c.clientId);
                              else next.add(c.clientId);
                              return next;
                            })
                          }
                        />
                        <span className="min-w-0">
                          <span className="block text-sm">{c.clientName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {!c.hasXero
                              ? "No Xero file linked"
                              : inOtherGroup
                                ? "Already in another group"
                                : c.tenantNames.join(", ")}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {selected.size < 2 && (
              <p className="text-xs text-amber-600">Select at least two companies.</p>
            )}

            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || selected.size < 2 || !name.trim()}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save group" : "Create group"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
