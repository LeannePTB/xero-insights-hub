import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listXeroConnections, startXeroConnect, disconnectXero } from "@/lib/xero/connections.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BarChart3, LogOut, Plug, Loader2, Trash2 } from "lucide-react";
import { PnlWidget } from "@/components/dashboard/PnlWidget";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Ledgerlight" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchConnections = useServerFn(listXeroConnections);
  const startConnect = useServerFn(startXeroConnect);
  const disconnect = useServerFn(disconnectXero);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["xero-connections"],
    queryFn: () => fetchConnections(),
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("xero") === "connected") {
      toast.success("Xero organisation connected");
      url.searchParams.delete("xero");
      window.history.replaceState({}, "", url.toString());
      refetch();
    }
    const err = url.searchParams.get("xero_error");
    if (err) {
      toast.error(`Xero connection failed: ${err}`);
      url.searchParams.delete("xero_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [refetch]);

  async function handleConnect() {
    try {
      const { authorizeUrl } = await startConnect({ data: { origin: window.location.origin } });
      window.location.href = authorizeUrl;
    } catch (e: any) {
      toast.error(e.message ?? "Could not start Xero connection");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function handleDisconnect(tenantId: string) {
    try {
      await disconnect({ data: { tenantId } });
      toast.success("Disconnected");
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Could not disconnect");
    }
  }

  const connections = data?.connections ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-semibold">Ledgerlight</span>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Your dashboards</h1>
            <p className="mt-1 text-sm text-muted-foreground">Connect a Xero organisation to start.</p>
          </div>
          <Button onClick={handleConnect}>
            <Plug className="mr-2 h-4 w-4" /> Connect Xero
          </Button>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : connections.length === 0 ? (
            <EmptyState onConnect={handleConnect} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {connections.map((c) => (
                <div key={c.id} className="group relative">
                  <button
                    onClick={() => handleDisconnect(c.tenant_id)}
                    className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    title="Disconnect"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <PnlWidget tenantId={c.tenant_id} tenantName={c.tenant_name} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
        <Plug className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold">Connect your first Xero org</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        You'll be sent to Xero to authorise access. Tokens are stored encrypted and only used to fetch reports.
      </p>
      <Button className="mt-6" onClick={onConnect}>
        <Plug className="mr-2 h-4 w-4" /> Connect Xero
      </Button>
    </div>
  );
}
