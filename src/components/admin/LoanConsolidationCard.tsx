import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layers, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listConsolidationGroups } from "@/lib/consolidation-groups.functions";

/**
 * Loan Consolidation summary for an organisation: every consolidation group
 * with the clients (and Xero files) inside it, plus entry points into the
 * loan consolidation workspace.
 */
export function LoanConsolidationCard({ firmId }: { firmId: string }) {
  const fetchGroups = useServerFn(listConsolidationGroups);
  const groupsQ = useQuery({
    queryKey: ["consolidation-groups", firmId],
    queryFn: () => fetchGroups({ data: { firmId } }),
  });

  const groups = groupsQ.data?.groups ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4 text-muted-foreground" /> Loan Consolidation
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Consolidation groups for this organisation and the companies in each one.
        </p>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              No consolidation groups yet.
            </p>
            <Button asChild size="sm">
              <Link to="/firms/$firmId/loans" params={{ firmId }} search={{ group: undefined }}>
                Create a group
              </Link>
            </Button>
          </div>
        )}

        {groups.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-border bg-background/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{group.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {group.clients.length}{" "}
                      {group.clients.length === 1 ? "company" : "companies"}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      to="/firms/$firmId/loans"
                      params={{ firmId }}
                      search={{ group: group.id }}
                    >
                      Open
                    </Link>
                  </Button>
                </div>

                {group.clients.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">No companies added yet.</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {group.clients.map((client) => (
                      <li key={client.clientId} className="flex flex-wrap items-center gap-2">
                        <span className="text-sm">{client.clientName}</span>
                        {client.tenantNames.map((tenant) => (
                          <Badge key={tenant} variant="secondary" className="text-[11px]">
                            {tenant}
                          </Badge>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
