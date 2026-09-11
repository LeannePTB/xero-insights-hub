import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import {
  getSecurityChecks,
  type PostureStatus,
} from "@/lib/security-posture.functions";

function StatusPill({ status }: { status: PostureStatus }) {
  if (status === "ok") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Pass</Badge>;
  }
  if (status === "warn") {
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Review</Badge>;
  }
  return <Badge variant="destructive">Action</Badge>;
}

export function SecurityPostureCard() {
  const fn = useServerFn(getSecurityChecks);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["security-checks"],
    queryFn: () => fn(),
    retry: false,
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Posture</h2>
            <p className="text-sm text-muted-foreground">
              Live checks run against the database on every load — no stored or assumed results.
              {data ? ` Last run ${new Date(data.generatedAt).toLocaleString("en-AU")}.` : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Re-run
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running checks…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {data?.ok ?? 0} pass · {data?.warn ?? 0} review · {data?.action ?? 0} action
            </p>
            <div className="divide-y">
              {(data?.checks ?? []).map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{c.title}</div>
                    <div className="text-sm text-muted-foreground">{c.detail}</div>
                    <div className="text-xs text-muted-foreground/80 mt-1 break-words">
                      Evidence: {c.evidence}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <StatusPill status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
