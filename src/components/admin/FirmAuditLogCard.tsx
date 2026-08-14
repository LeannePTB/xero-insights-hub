import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2 } from "lucide-react";
import { getFirmAuditAdmin } from "@/lib/admin.functions";

function fmt(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

export function FirmAuditLogCard({ firmId }: { firmId: string }) {
  const getAudit = useServerFn(getFirmAuditAdmin);
  const auditQ = useQuery({
    queryKey: ["firm-audit", firmId],
    queryFn: () => getAudit({ data: { firmId } }),
  });

  const events = auditQ.data?.events ?? [];

  return (
    <section className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Audit log</h2>
      </div>
      {auditQ.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : auditQ.error ? (
        <p className="text-sm text-muted-foreground">Unable to load the audit log.</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {events.map((e: any) => (
            <li key={e.id} className="flex items-start gap-3 border-t pt-2">
              <span className="text-muted-foreground tabular-nums whitespace-nowrap">{fmt(e.at)}</span>
              <span className="font-medium">{e.action}</span>
              <span className="text-muted-foreground truncate">{JSON.stringify(e.meta)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
