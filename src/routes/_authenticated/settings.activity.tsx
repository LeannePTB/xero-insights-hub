import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLoginEvents } from "@/lib/login-log.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/activity")({
  head: () => ({ meta: [{ title: "Login activity — Traction Advisory" }] }),
  component: ActivityPage,
});

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function ActivityPage() {
  const fetchEvents = useServerFn(listLoginEvents);
  const { data, isLoading, error } = useQuery({
    queryKey: ["login-events"],
    queryFn: () => fetchEvents({ data: {} }),
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Back to clients</Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Login activity</h1>
            <p className="text-sm text-muted-foreground">Who signed in and when.</p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <p className="p-6 text-sm text-destructive">{(error as Error).message}</p>
          ) : !data?.events.length ? (
            <p className="p-6 text-sm text-muted-foreground">No logins recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">When</th>
                    <th className="px-4 py-3 text-left font-medium">User</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">IP</th>
                    <th className="px-4 py-3 text-left font-medium">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e) => (
                    <tr key={e.id} className="border-t border-border/60">
                      <td className="whitespace-nowrap px-4 py-3 text-foreground/90">{fmt(e.occurred_at)}</td>
                      <td className="px-4 py-3 text-foreground/90">{e.display_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.email ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{e.ip ?? "—"}</td>
                      <td className="max-w-[24rem] truncate px-4 py-3 text-xs text-muted-foreground" title={e.user_agent ?? ""}>
                        {e.user_agent ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
