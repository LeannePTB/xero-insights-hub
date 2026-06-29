import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listXeroLog } from "@/lib/xero/log.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/$clientId/xero-log/$tenantId")({
  head: () => ({ meta: [{ title: "Xero integration log — Traction Advisory" }] }),
  component: XeroLogPage,
});

type LogRow = {
  id: string;
  action: string;
  target_id: string | null;
  meta: any;
  at: string;
};

function actionStyle(action: string): { label: string; tone: "ok" | "warn" | "err"; Icon: typeof CheckCircle2 } {
  if (action === "xero_api_error") return { label: "API error", tone: "err", Icon: AlertCircle };
  if (action === "xero_connected") return { label: "Connected", tone: "ok", Icon: CheckCircle2 };
  if (action === "xero_disconnected") return { label: "Disconnected", tone: "warn", Icon: AlertCircle };
  return { label: action.replace(/^xero_/, "").replace(/_/g, " "), tone: "warn", Icon: AlertCircle };
}

function XeroLogPage() {
  const { clientId, tenantId } = Route.useParams();
  const fetchLog = useServerFn(listXeroLog);
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["xeroLog", tenantId],
    queryFn: () => fetchLog({ data: { tenantId } }),
  });

  const rows = (data?.rows ?? []) as LogRow[];

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/clients/$clientId/settings" params={{ clientId }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to settings
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Xero integration log</CardTitle>
          <p className="text-xs text-muted-foreground">
            Recent connect, disconnect, and API error events for this organisation. Use this to diagnose
            "data could not load" errors, missing scopes, or unexpected disconnects.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading log…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded yet for this organisation.</p>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => {
                const s = actionStyle(r.action);
                const meta = r.meta ?? {};
                return (
                  <li key={r.id} className="flex items-start gap-3 py-3 text-sm">
                    <s.Icon
                      className={
                        s.tone === "err"
                          ? "mt-0.5 h-4 w-4 text-destructive"
                          : s.tone === "ok"
                            ? "mt-0.5 h-4 w-4 text-emerald-600"
                            : "mt-0.5 h-4 w-4 text-amber-600"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            s.tone === "err"
                              ? "border-destructive/40 text-destructive"
                              : s.tone === "ok"
                                ? "border-emerald-600/40 text-emerald-700"
                                : "border-amber-600/40 text-amber-700"
                          }
                        >
                          {s.label}
                        </Badge>
                        {meta.path ? <code className="text-xs text-muted-foreground">{meta.path}</code> : null}
                        {meta.status ? <span className="text-xs text-muted-foreground">HTTP {meta.status}</span> : null}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {new Date(r.at).toLocaleString()}
                        </span>
                      </div>
                      {meta.message ? (
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs text-foreground/80">
                          {String(meta.message)}
                        </pre>
                      ) : null}
                      {meta.tenant_name ? (
                        <p className="mt-1 text-xs text-muted-foreground">{meta.tenant_name}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
