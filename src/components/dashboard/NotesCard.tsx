import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addClientNote,
  deleteClientNote,
  listClientNotes,
  updateClientNote,
} from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, StickyNote, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Note = {
  id: string;
  body: string;
  author_id: string | null;
  author_name: string;
  created_at: string;
  updated_at: string;
  is_mine: boolean;
  include_in_report: boolean;
};

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function NotesCard({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listClientNotes);
  const addFn = useServerFn(addClientNote);
  const updateFn = useServerFn(updateClientNote);
  const deleteFn = useServerFn(deleteClientNote);

  const { data, isLoading } = useQuery({
    queryKey: ["client-notes", clientId],
    queryFn: () => listFn({ data: { clientId } }),
  });
  const notes: Note[] = (data?.notes ?? []) as Note[];
  const canFlagForReport = data?.canFlagForReport === true;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [draftInReport, setDraftInReport] = useState(false);
  const [editInReport, setEditInReport] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["client-notes", clientId] });

  const addMut = useMutation({
    mutationFn: () => addFn({ data: { clientId, body: draft, includeInReport: draftInReport } }),
    onSuccess: () => {
      toast.success("Note added");
      setDraft("");
      setDraftInReport(false);
      setAdding(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { noteId: string; body: string; includeInReport: boolean }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Note updated");
      setEditingId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (noteId: string) => deleteFn({ data: { noteId } }),
    onSuccess: () => {
      toast.success("Note deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
          <StickyNote className="h-4 w-4" />
        </div>
        <h2 className="font-display text-lg font-semibold">Notes</h2>
      </div>

      {canEdit && (
        <div className="mb-4">
          {!adding ? (
            <Button
              variant="outline"
              className="h-auto w-full justify-start py-2.5 text-muted-foreground"
              onClick={() => setAdding(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Add note
            </Button>
          ) : (
            <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                placeholder="Write a note…"
                autoFocus
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {canFlagForReport ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={draftInReport}
                      onCheckedChange={(v) => setDraftInReport(v === true)}
                    />
                    Include in management report
                  </label>
                ) : (
                  <span className="text-xs text-muted-foreground">Internal note</span>
                )}
                <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setAdding(false); setDraft(""); setDraftInReport(false); }}
                  disabled={addMut.isPending}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={() => addMut.mutate()} disabled={addMut.isPending || !draft.trim()}>
                  {addMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                  Save
                </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes recorded for this client.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const isEditing = editingId === n.id;
            return (
              <li key={n.id} className="rounded-lg border border-border bg-background/30 p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex flex-wrap items-center gap-2">
                    <span>
                      {n.author_name} · {fmt(n.created_at)}
                      {n.updated_at !== n.created_at && " (edited)"}
                    </span>
                    {n.include_in_report && (
                      <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                        In report
                      </span>
                    )}
                  </span>
                  {(canEdit || n.is_mine) && !isEditing && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => { setEditingId(n.id); setEditValue(n.body); setEditInReport(n.include_in_report); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this note?")) deleteMut.mutate(n.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={4} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {canFlagForReport ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox
                            checked={editInReport}
                            onCheckedChange={(v) => setEditInReport(v === true)}
                          />
                          Include in management report
                        </label>
                      ) : (
                        <span className="text-xs text-muted-foreground">Internal note</span>
                      )}
                      <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={updateMut.isPending}>
                        <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          updateMut.mutate({ noteId: n.id, body: editValue, includeInReport: editInReport })
                        }
                        disabled={
                          updateMut.isPending ||
                          !editValue.trim() ||
                          (editValue === n.body && editInReport === n.include_in_report)
                        }
                      >
                        {updateMut.isPending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">{n.body}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
