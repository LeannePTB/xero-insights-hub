import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listXeroApiErrors } from "@/lib/xero-errors.functions";

function fmt(s: string) {
  return new Date(s).toLocaleString();
}

export function XeroApiErrorsSheet({
  firmId,
  organisationName,
  trigger,
}: {
  firmId?: string | null;
  organisationName?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<7 | 30>(7);
  const fetchErrors = useServerFn(listXeroApiErrors);

  const q = useQuery({
    queryKey: ["xero-api-errors", firmId ?? "all", days],
    queryFn: () => fetchErrors({ data: { days, firmId: firmId ?? null } }),
    enabled: open,
  });

  const groups = q.data?.groups ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Xero API errors ({days} days)
            {organisationName ? ` — ${organisationName}` : ""}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant={days === 7 ? "default" : "outline"} onClick={() => setDays(7)}>
            Last 7 days
          </Button>
          <Button size="sm" variant={days === 30 ? "default" : "outline"} onClick={() => setDays(30)}>
            Last 30 days
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {q.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading errors…
            </div>
          ) : q.error ? (
            <p className="text-sm text-destructive">{(q.error as Error).message}</p>
          ) : groups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
              <p className="mt-2 text-sm font-medium">
                No Xero errors in the last {days} days.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nothing to diagnose — report calls to Xero are completing normally.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.key} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{g.organisation}</span>
                  <code className="text-xs text-muted-foreground">{g.path}</code>
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    HTTP {g.status}
                  </Badge>
                  <span className="ml-auto tabular-nums font-medium">{g.count}×</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  First seen {fmt(g.firstSeen)} · Last seen {fmt(g.lastSeen)}
                </p>
                {g.message ? (
                  <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs text-foreground/80">
                    {g.message}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Identical failures are recorded once per five minutes, so each count is the number of
          distinct failure windows rather than every attempt.
        </p>
      </SheetContent>
    </Sheet>
  );
}
