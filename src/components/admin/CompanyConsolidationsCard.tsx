import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listConsolidationGroups } from "@/lib/consolidation-groups.functions";

/**
 * Company Consolidations summary for an organisation.
 */
export function CompanyConsolidationsCard({ firmId }: { firmId: string }) {
  const fetchGroups = useServerFn(listConsolidationGroups);
  const groupsQ = useQuery({
    queryKey: ["consolidation-groups", firmId],
    queryFn: () => fetchGroups({ data: { firmId } }),
  });

  const groups = groupsQ.data?.groups ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Layers className="h-4 w-4 text-muted-foreground" /> Company Consolidations
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Consolidation groups for this organisation and the companies in each one.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/firms/$firmId/loans" params={{ firmId }} search={{ group: undefined }}>
            Open
          </Link>
        </Button>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        {groupsQ.isLoading && (
          <p className="text-xs text-muted-foreground">
            <Loader2 className="mr-2 inline h-3 w-3 animate-spin" /> Loading groups…
          </p>
        )}

        {groupsQ.isError && (
          <p className="text-xs text-destructive">Couldn&apos;t load consolidation groups.</p>
        )}

        {!groupsQ.isLoading && !groupsQ.isError && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No consolidation groups yet.
          </p>
        )}

        {!groupsQ.isLoading && !groupsQ.isError && groups.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {groups.length} {groups.length === 1 ? "group" : "groups"} configured.
          </p>
        )}
      </div>
    </div>
  );
}
