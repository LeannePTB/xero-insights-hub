import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFirmsAdmin } from "@/lib/admin.functions";
import { getMyContext } from "@/lib/roles.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Traction Advisory" }] }),
  component: AdminPage,
});

type FirmRow = {
  firm_id: string;
  firm_name: string;
  is_always_free: boolean;
  firm_created_at: string;
  tier: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  connection_count: number;
  recent_error_count: number;
};

const TIER_LIMITS: Record<string, number> = { starter: 5, growth: 10, scale: 20, firm: 50, legacy: 9999 };

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

function AdminPage() {
  const fetchCtx = useServerFn(getMyContext);
  const fetchFirms = useServerFn(listFirmsAdmin);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const firmsQ = useQuery({
    queryKey: ["admin-firms"],
    queryFn: () => fetchFirms(),
    enabled: !!ctxQ.data,
  });

  if (ctxQ.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSuper = (ctxQ.data as any)?.isSuperAdmin ?? false;
  // fallback: if getMyContext doesn't expose isSuperAdmin yet, the server fn will throw and we show Forbidden.

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
          </Button>
          <h1 className="text-xl font-semibold">Super-admin</h1>
          <Badge variant="secondary" className="ml-2">redacted view</Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <p className="text-sm text-muted-foreground">
          Firm name, tier, usage, billing and error counts only. No Xero org names, balances, or client data are visible from this page — enforced at the database level.
        </p>

        {firmsQ.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading firms…</div>
        )}

        {firmsQ.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Access denied</p>
              <p className="text-sm text-muted-foreground">{(firmsQ.error as Error).message}</p>
            </div>
          </div>
        )}

        {firmsQ.data && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Firm</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Next bill / trial</th>
                  <th className="px-4 py-3">Errors (7d)</th>
                </tr>
              </thead>
              <tbody>
                {(firmsQ.data.firms as FirmRow[]).map((f) => {
                  const limit = f.tier ? TIER_LIMITS[f.tier] ?? null : null;
                  return (
                    <tr key={f.firm_id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{f.firm_name}</div>
                        {f.is_always_free && <Badge variant="outline" className="mt-1">always free</Badge>}
                      </td>
                      <td className="px-4 py-3 capitalize">{f.tier ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {f.connection_count}{limit && limit < 9999 ? ` / ${limit}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={f.status === "active" || f.status === "trialing" ? "default" : "secondary"} className="capitalize">
                          {f.status ?? "—"}
                        </Badge>
                        {f.cancel_at_period_end && <Badge variant="outline" className="ml-1">cancelling</Badge>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {f.status === "trialing"
                          ? `trial ends ${fmtDate(f.trial_ends_at)}`
                          : fmtDate(f.current_period_end)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {f.recent_error_count > 0 ? (
                          <span className="text-destructive font-medium">{f.recent_error_count}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {firmsQ.data.firms.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No firms yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
