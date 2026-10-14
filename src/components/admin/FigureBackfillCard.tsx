import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFigureBackfillStatus, startFigureBackfill } from "@/lib/overview/figure-backfill.functions";

/** System Administrator only (enforced in the database). Shows counts and reasons, never figures. */
export function FigureBackfillCard() {
  const fetchStatus = useServerFn(getFigureBackfillStatus);
  const start = useServerFn(startFigureBackfill);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["figure-backfill-status"],
    queryFn: () => fetchStatus(),
    retry: false,
    refetchInterval: (query) => (["queued", "running"].includes((query.state.data as any)?.run?.status) ? 30_000 : false),
  });
  const m = useMutation({
    mutationFn: () => start({ data: {} }),
    onSuccess: () => { toast.success("History fill queued. It runs in the background, five Xero files an hour."); qc.invalidateQueries({ queryKey: ["figure-backfill-status"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const run = q.data?.run;
  const items = q.data?.items ?? [];
  const busy = run?.status === "queued" || run?.status === "running";
  const counts = items.reduce<Record<string, number>>((a, i) => ({ ...a, [i.status ?? "?"]: (a[i.status ?? "?"] ?? 0) + 1 }), {});
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Fill 12 months of history</CardTitle>
          <p className="text-sm text-muted-foreground">One-off: month-end cash at bank and monthly net profit from Xero, for every connected client file. About 14 Xero requests per file. Daily figures are never replaced.</p>
        </div>
        <Button onClick={() => m.mutate()} disabled={busy || m.isPending}>{busy ? "Running…" : "Fill 12 months of history"}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isError && <p className="text-sm text-destructive">Progress could not be loaded.</p>}
        {!run && !q.isLoading && <p className="text-sm text-muted-foreground">Not run yet.</p>}
        {run && (
          <p className="text-sm">
            Status: <Badge variant="secondary">{run.status}</Badge>{" "}
            {Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" · ")}
          </p>
        )}
        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-1 pr-3">Organisation</th><th className="pr-3">Client</th><th className="pr-3">Xero file</th><th className="pr-3">Result</th><th className="pr-3">Cash months</th><th className="pr-3">Profit months</th><th>Note</th></tr>
              </thead>
              <tbody>
                {items.map((i, n) => (
                  <tr key={n} className="border-t border-border">
                    <td className="py-1 pr-3">{i.organisation}</td><td className="pr-3">{i.client}</td><td className="pr-3">{i.file ?? "—"}</td>
                    <td className="pr-3">{i.status}</td><td className="pr-3">{i.monthsCash}</td><td className="pr-3">{i.monthsProfit}</td>
                    <td className="text-muted-foreground">{i.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
