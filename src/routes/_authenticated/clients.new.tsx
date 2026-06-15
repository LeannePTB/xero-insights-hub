import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listXeroConnections, startXeroConnect } from "@/lib/xero/connections.functions";
import { createClient } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plug } from "lucide-react";

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
  const fetchConnections = useServerFn(listXeroConnections);
  const startConnect = useServerFn(startXeroConnect);
  const create = useServerFn(createClient);

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const connQ = useQuery({ queryKey: ["xero-connections"], queryFn: () => fetchConnections() });

  const createMut = useMutation({
    mutationFn: () => create({ data: { name, xeroConnectionIds: [...selected], firmId } }),
    onSuccess: ({ id }) => {
      toast.success("Client created");
      navigate({ to: "/clients/$clientId", params: { clientId: id }, replace: true });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not create client"),
  });

  async function handleConnect() {
    const authWindow = window.open("about:blank", "_blank");
    try {
      const { authorizeUrl } = await startConnect({ data: { origin: window.location.origin } });
      if (authWindow) { authWindow.opener = null; authWindow.location.href = authorizeUrl; }
      else window.location.href = authorizeUrl;
    } catch (e: any) {
      authWindow?.close();
      toast.error(e.message ?? "Could not start Xero connection");
    }
  }

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          {firmId ? (
            <Link to="/firms/$firmId" params={{ firmId }}><ArrowLeft className="mr-1 h-4 w-4" /> Back to business</Link>
          ) : (
            <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Back to clients</Link>
          )}
        </Button>
        <h1 className="font-display text-3xl font-semibold">New client</h1>
        <p className="mt-1 text-sm text-muted-foreground">A client is a company you track. Link one or more Xero organisations to it.</p>

        <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div>
            <Label htmlFor="name">Client name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Pty Ltd" className="mt-1.5" />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Xero organisations</Label>
              <Button variant="outline" size="sm" onClick={handleConnect}>
                <Plug className="mr-1.5 h-3.5 w-3.5" /> Connect another
              </Button>
            </div>
            <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-background p-3">
              {connQ.isLoading ? (
                <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
              ) : (connQ.data?.connections ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No Xero organisations connected yet. Click "Connect another" above.</p>
              ) : (
                (connQ.data?.connections ?? []).map((c: any) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <span className="text-sm font-medium">{c.tenant_name}</span>
                    <span className="text-xs text-muted-foreground">{c.tenant_type}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" asChild><Link to="/dashboard">Cancel</Link></Button>
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
