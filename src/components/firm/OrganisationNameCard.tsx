import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renameMyOrganisation } from "@/lib/firms.functions";
import { useFirmSettingsSummary } from "./useFirmSettingsSummary";

/** Owner-only rename; the database decides (rename_my_organisation). */
export function OrganisationNameCard({ firmId }: { firmId: string }) {
  const q = useFirmSettingsSummary(firmId);
  const qc = useQueryClient();
  const rename = useServerFn(renameMyOrganisation);
  const [name, setName] = useState("");
  useEffect(() => {
    if (q.data) setName(q.data.firm.name);
  }, [q.data?.firm.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = useMutation({
    mutationFn: () => rename({ data: { firmId, name } }),
    onSuccess: () => {
      toast.success("Organisation renamed");
      qc.invalidateQueries();
    },
    onError: (e: Error) =>
      toast.error(e.message === "Forbidden" ? "Only the organisation owner can rename it." : e.message),
  });

  if (!q.data) return null;
  const canEdit = q.data.isOwner;
  const trimmed = name.trim();
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <Label htmlFor="org-name" className="text-sm font-medium">Organisation name</Label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Input id="org-name" value={name} maxLength={120} disabled={!canEdit} onChange={(e) => setName(e.target.value)} className="max-w-md" />
        {canEdit && (
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || trimmed.length < 2 || trimmed === q.data.firm.name}
          >
            {m.isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
      {!canEdit && <p className="mt-2 text-xs text-muted-foreground">Only the organisation owner can change the name.</p>}
    </section>
  );
}
