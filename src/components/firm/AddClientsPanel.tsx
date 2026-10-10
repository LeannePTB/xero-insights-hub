import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddClientFromXeroButton } from "@/components/admin/AddClientFromXeroButton";
import { useFirmSettingsSummary } from "./useFirmSettingsSummary";

/** Add-client actions and limit usage. Plan limits are enforced by database triggers. */
export function AddClientsPanel({ firmId }: { firmId: string }) {
  const q = useFirmSettingsSummary(firmId);
  if (!q.data) return null;
  const { clientCount, clientLimit } = q.data;
  const full = clientCount >= clientLimit;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-sm font-medium">Add clients</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {clientCount} of {clientLimit} clients used.
        {full
          ? " Client limit reached — increase the organisation's client allowance to add more."
          : " Connect a Xero file or set up a client manually."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <AddClientFromXeroButton firmId={firmId} disabled={full} />
        <Button variant="outline" asChild={!full} disabled={full}>
          {full ? (
            <span><Plus className="mr-2 h-4 w-4" /> New client</span>
          ) : (
            <Link to="/clients/new" search={{ firmId } as any}>
              <Plus className="mr-2 h-4 w-4" /> New client
            </Link>
          )}
        </Button>
      </div>
    </section>
  );
}
