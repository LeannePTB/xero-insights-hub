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

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["client-notes", clientId] });

  const addMut = useMutation({
    mutationFn: () => addFn({ data: { clientId, body: draft } }),
    onSuccess: () => {
      toast.success("Note added");
      setDraft("");
      setAdding(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { noteId: string; body: string }) => updateFn({ data: vars }),
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
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
            <StickyNote className="h-4 w-4" />
          </div>
          <h2 className="font-display text-lg font-semibold">Notes</h2>
        </div>
        {canEdit && !adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add note
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-4 space-y-2 rounded-lg border border-border bg-background/50 p-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="Write a note…"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setAdding(false); setDraft(""); }}
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
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit ? "No notes yet. Click Add note to write one." : "No notes."}
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const isEditing = editingId === n.id;
            return (
              <li key={n.id} className="rounded-lg border border-border bg-background/30 p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {n.author_name} · {fmt(n.created_at)}
                    {n.updated_at !== n.created_at && " (edited)"}
                  </span>
                  {(canEdit || n.is_mine) && !isEditing && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => { setEditingId(n.id); setEditValue(n.body); }}
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
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={updateMut.isPending}>
                        <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateMut.mutate({ noteId: n.id, body: editValue })}
                        disabled={updateMut.isPending || !editValue.trim() || editValue === n.body}
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
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{n.body}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
