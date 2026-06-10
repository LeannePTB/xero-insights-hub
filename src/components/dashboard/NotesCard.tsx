import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateClientNotes } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, StickyNote, Pencil, X } from "lucide-react";
import { toast } from "sonner";

export function NotesCard({
  clientId,
  initialNotes,
  canEdit,
}: {
  clientId: string;
  initialNotes: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(updateClientNotes);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes ?? "");

  useEffect(() => {
    if (!editing) setValue(initialNotes ?? "");
  }, [initialNotes, editing]);

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { clientId, notes: value } }),
    onSuccess: () => {
      toast.success("Notes saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
            <StickyNote className="h-4 w-4" />
          </div>
          <h2 className="font-display text-lg font-semibold">Notes</h2>
        </div>
        {canEdit && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> {initialNotes ? "Edit" : "Add"}
          </Button>
        )}
        {canEdit && editing && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEditing(false); setValue(initialNotes ?? ""); }}
              disabled={saveMut.isPending}
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || value === initialNotes}>
              {saveMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          placeholder="Write notes for this client…"
        />
      ) : initialNotes?.trim() ? (
        <p className="whitespace-pre-wrap text-sm text-foreground/90">{initialNotes}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {canEdit ? "No notes yet. Click Add to write one." : "No notes."}
        </p>
      )}
    </section>
  );
}
