import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createClient } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/new")({
  head: () => ({ meta: [{ title: "New client — Traction Advisory" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    firmId: typeof search.firmId === "string" ? search.firmId : undefined,
  }),
  component: NewClient,
});

function NewClient() {
  const navigate = useNavigate();
  const { firmId } = Route.useSearch();
  const create = useServerFn(createClient);

  const [name, setName] = useState("");

  const createMut = useMutation({
    mutationFn: () => create({ data: { name, xeroConnectionIds: [], firmId } }),
    onSuccess: ({ id }) => {
      toast.success("Client created");
      navigate({ to: "/clients/$clientId", params: { clientId: id }, replace: true });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not create client"),
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          {firmId ? (
            <Link to="/firms/$firmId" params={{ firmId }}><ArrowLeft className="mr-1 h-4 w-4" /> Back to organisation</Link>
          ) : (
            <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Back to clients</Link>
          )}
        </Button>
        <h1 className="font-display text-3xl font-semibold">New client</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create the subscription first, then connect its Xero file from that client's settings.</p>

        <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div>
            <Label htmlFor="name">Client name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Pty Ltd" className="mt-1.5" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" asChild>
              {firmId ? (
                <Link to="/firms/$firmId" params={{ firmId }}>Cancel</Link>
              ) : (
                <Link to="/dashboard">Cancel</Link>
              )}
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create client
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
