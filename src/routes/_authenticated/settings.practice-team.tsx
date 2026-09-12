import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  addPracticeMember,
  listPracticeTeam,
  removePracticeMember,
} from "@/lib/practice-team.functions";
import { getMyContext } from "@/lib/roles.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/settings/practice-team")({
  head: () => ({
    meta: [
      { title: "Practice team — Traction Advisory" },
      {
        name: "description",
        content:
          "Choose which Traction Advisory people are added as members whenever a new client organisation is created.",
      },
      { property: "og:title", content: "Practice team — Traction Advisory" },
      {
        property: "og:description",
        content:
          "Choose which Traction Advisory people are added as members whenever a new client organisation is created.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PracticeTeamPage,
});

function PracticeTeamPage() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getMyContext);
  const fetchList = useServerFn(listPracticeTeam);
  const addFn = useServerFn(addPracticeMember);
  const removeFn = useServerFn(removePracticeMember);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const isSuperAdmin = ctxQ.data?.isSuperAdmin ?? false;
  const listQ = useQuery({
    queryKey: ["practice-team"],
    queryFn: () => fetchList(),
    enabled: isSuperAdmin,
  });

  const [email, setEmail] = useState("");

  const addMut = useMutation({
    mutationFn: () => addFn({ data: { email } }),
    onSuccess: (r) => {
      toast.success(r.alreadyThere ? "Already on the practice team" : "Added to the practice team");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["practice-team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => removeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Removed from the practice team");
      qc.invalidateQueries({ queryKey: ["practice-team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ctxQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!isSuperAdmin) {
    return <p className="p-6 text-sm text-destructive">Platform admins only.</p>;
  }

  const members = listQ.data?.members ?? [];

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-3xl font-semibold">Practice team</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          These are the Traction Advisory people who are added as members of every new client
          organisation we create, so nobody has to add themselves afterwards. Being on this list on
          its own gives no access to any organisation or client — access still comes from the
          membership row created at that moment, and the organisation's owner can remove it.
        </p>

        <div className="mt-8 rounded-lg border border-border p-5">
          <h2 className="text-sm font-medium">Add someone</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            They need a Traction Advisory login already. Adding or removing someone here is recorded
            in the audit trail.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addMut.mutate();
            }}
          >
            <Input
              type="email"
              placeholder="name@tractionadvisory.com.au"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" disabled={addMut.isPending}>
              {addMut.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-1 h-4 w-4" />
              )}
              Add
            </Button>
          </form>
        </div>

        <div className="mt-6 rounded-lg border border-border">
          {listQ.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          ) : members.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              Nobody on the practice team yet. New organisations will still be created — the person
              creating one becomes its owner, and nobody else is added.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.displayName ?? m.email}</p>
                    {m.displayName && m.email ? (
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMut.mutate(m.userId)}
                    disabled={removeMut.isPending}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Removing someone here does not remove them from organisations they were already added to,
          and it never changes an existing membership.
        </p>
      </div>
    </AdminShell>
  );
}
