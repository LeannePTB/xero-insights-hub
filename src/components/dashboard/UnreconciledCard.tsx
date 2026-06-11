import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getStatementSummary } from "@/lib/unreconciled.functions";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileSpreadsheet, Loader2 } from "lucide-react";

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
}

export function UnreconciledCard({ clientId }: { clientId: string }) {
  const fetchSummary = useServerFn(getStatementSummary);
  const q = useQuery({
    queryKey: ["unreconciled-summary", clientId],
    queryFn: () => fetchSummary({ data: { clientId } }),
  });

  const upload = q.data?.upload;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Uncoded statement lines</h2>
            {q.isLoading ? (
              <p className="mt-1 text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Loading…</p>
            ) : upload ? (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{upload.line_count}</span> {upload.line_count === 1 ? "line" : "lines"} · uploaded {fmtDate(upload.created_at)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No statement file uploaded yet.</p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/clients/$clientId/unreconciled" params={{ clientId }}>
            Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
