import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createClient } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AddClientFromXeroButton } from "@/components/admin/AddClientFromXeroButton";
import { listStandingViewers } from "@/lib/viewers.functions";

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

  // Anyone who can already see every client in this organisation will see this
  // one too, the moment it exists. Say so before the button is pressed.
  const fetchStanding = useServerFn(listStandingViewers);
  const standingQ = useQuery({
    queryKey: ["standing-viewers", firmId],
    queryFn: () => fetchStanding({ data: { firmId: firmId! } }),
    enabled: !!firmId,
  });
  const standing = standingQ.data?.viewers ?? [];

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
        <h1 className="font-display text-3xl font-semibold">New client subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">Creates a client subscription (its own dashboard and Xero files) inside this organisation. Connect its Xero file from the client settings afterwards.</p>

        {firmId && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div>
              <h2 className="font-medium">Already have their Xero file?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Authorise the Xero organisation and we&apos;ll create the client for you, named after the Xero organisation.
              </p>
            </div>
            <AddClientFromXeroButton firmId={firmId} />
          </div>
        )}

        <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div>
            <Label htmlFor="name">Client name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Pty Ltd" className="mt-1.5" />
          </div>

          {standing.length > 0 && (
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {standing.map((v) => v.displayName ?? v.email).join(", ")}{" "}
              {standing.length === 1 ? "already sees" : "already see"} every client in this
              organisation, so {standing.length === 1 ? "they" : "they"} will be able to see this new
              client as soon as you create it.
            </p>
          )}

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
