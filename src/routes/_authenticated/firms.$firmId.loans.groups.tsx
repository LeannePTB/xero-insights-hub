import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/firms/$firmId/loans/groups")({
  component: LoanGroupsTab,
});

const MAX_CHIPS = 7;

function LoanGroupsTab() {
  const { firmId } = Route.useParams();
  const qc = useQueryClient();
  const fetchGroups = useServerFn(listConsolidationGroups);
  const saveGroup = useServerFn(saveConsolidationGroup);
  const removeGroup = useServerFn(deleteConsolidationGroup);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConsolidationGroup | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["consolidation-groups", firmId],
    queryFn: () => fetchGroups({ data: { firmId } }),
  });
  const view = q.data;
  const groups = view?.groups ?? [];

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
      saveGroup({ data: { firmId, groupId: editing?.id, name, clientIds: [...selected] } }),
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
    <div>
      <h2 className="font-display text-3xl font-semibold tracking-tight">Loan Consolidation groups</h2>
      <p className="mt-2 text-muted-foreground">
        Create saved groups of client companies. The Loan Consolidation matrix runs against a group's member Xero
        files.
      </p>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="text-muted-foreground">
          {q.isLoading ? "Loading groups…" : `${groups.length} saved group${groups.length === 1 ? "" : "s"}`}
        </p>
        {view?.multiCompany && (
          <Button size="lg" onClick={openNew} disabled={(view?.clients.length ?? 0) < 2}>
            <Plus className="mr-2 h-4 w-4" /> New group
          </Button>
        )}
      </div>

      {q.error && <p className="mt-4 text-sm text-destructive">{(q.error as Error).message}</p>}

      {view && !view.multiCompany && (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Consolidation is part of the multi-company plan. Upgrade this organisation's plan to combine companies.
        </p>
      )}

      {view?.multiCompany && groups.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          No consolidation groups yet. Create one and tick the companies to combine.
        </p>
      )}

      {groups.length > 0 && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {groups.map((g) => {
            const isOpen = expanded.has(g.id);
            const shown = isOpen ? g.clients : g.clients.slice(0, MAX_CHIPS);
            const hidden = g.clients.length - shown.length;
            return (
              <div
                key={g.id}
                className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 font-display text-xl font-semibold">
                      <Bookmark className="h-5 w-5 text-primary" />
                      {g.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {g.clients.length} {g.clients.length === 1 ? "company" : "companies"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(g)} aria-label="Edit group">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label="Delete group"
                      onClick={() => {
                        if (confirm(`Delete "${g.name}"?`)) del.mutate(g.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {shown.map((c) => (
                    <span
                      key={c.clientId}
                      className="rounded-full bg-muted px-3 py-1.5 text-sm text-foreground/80"
                    >
                      {c.clientName}
                    </span>
                  ))}
                  {hidden > 0 && (
                    <button
                      type="button"
                      className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium hover:bg-muted/70"
                      onClick={() =>
                        setExpanded((cur) => {
                          const next = new Set(cur);
                          next.add(g.id);
                          return next;
                        })
                      }
                    >
                      +{hidden} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

            {selected.size < 2 && <p className="text-xs text-amber-600">Select at least two companies.</p>}

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
    </div>
  );
}
