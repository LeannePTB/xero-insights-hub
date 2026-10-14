import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getOrgEarlyAccess, saveOrgEarlyAccess, type OrgEarlyAccessRow } from "@/lib/card-model.functions";

/**
 * Early access: lets one organisation try Work-in-progress cards. Presentation
 * only — public.admin_set_org_early_access re-checks the second factor and
 * System Administrator, and writes the audit row; the single card rule decides
 * who then sees the card.
 */
export function OrgEarlyAccessCard({ firmId }: { firmId: string }) {
  const fetchRows = useServerFn(getOrgEarlyAccess);
  const q = useQuery({ queryKey: ["org-early-access", firmId], queryFn: () => fetchRows({ data: { firmId } }), retry: false });

  return (
    <section className="space-y-4 rounded-lg border p-6">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Early access</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Let this organisation try cards marked Work in progress. Its Organisation Owner can then tick them per client;
        only the organisation's own team sees them. Business Owners, Viewers, reports and Trixie never do.
      </p>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (q.data?.rows ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No cards are Work in progress.</p>
      ) : (
        <ul className="space-y-2">
          {q.data!.rows.map((r) => <EarlyAccessRow key={r.cardKey} firmId={firmId} row={r} />)}
        </ul>
      )}
    </section>
  );
}

function EarlyAccessRow({ firmId, row }: { firmId: string; row: OrgEarlyAccessRow }) {
  const qc = useQueryClient();
  const save = useServerFn(saveOrgEarlyAccess);
  const [ticked, setTicked] = useState(row.granted);
  const [ends, setEnds] = useState(row.endsAt ? row.endsAt.slice(0, 10) : "");
  useEffect(() => { setTicked(row.granted); setEnds(row.endsAt ? row.endsAt.slice(0, 10) : ""); }, [row.granted, row.endsAt]);

  const savedEnds = row.endsAt ? row.endsAt.slice(0, 10) : "";
  const dirty = ticked !== row.granted || (ticked && ends !== savedEnds);
  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          firmId,
          cardKey: row.cardKey,
          enabled: ticked,
          // End of the chosen day, Perth time.
          endsAt: ticked && ends ? `${ends}T23:59:59+08:00` : null,
        },
      }),
    onSuccess: () => {
      toast.success(ticked ? `Early access to ${row.label} saved` : `Early access to ${row.label} removed`);
      qc.invalidateQueries({ queryKey: ["org-early-access", firmId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Early access could not be saved."),
  });

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
      <Checkbox id={`ea-${row.cardKey}`} checked={ticked} onCheckedChange={(v) => setTicked(v === true)} aria-label={`Early access to ${row.label}`} />
      <label htmlFor={`ea-${row.cardKey}`} className="min-w-0 flex-1">
        <span className="block font-medium">{row.label}</span>
        <span className="block text-xs text-muted-foreground">
          {row.moduleLabel ? `${row.moduleLabel} · ` : ""}
          {row.granted ? (row.active ? "Early access on" : "Early access ended") : "No early access"}
        </span>
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Ends (optional)
        <Input type="date" className="h-8 w-40" value={ends} disabled={!ticked} onChange={(e) => setEnds(e.target.value)} />
      </label>
      <Button size="sm" onClick={() => mut.mutate()} disabled={!dirty || mut.isPending}>
        {mut.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Save
      </Button>
    </li>
  );
}
