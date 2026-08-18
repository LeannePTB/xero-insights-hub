import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listOrganisationMembers, transferOrganisationOwnership } from "@/lib/ownership.functions";

/** Owner-only handover of an organisation to another active member. */
export function TransferOwnershipCard({ firmId }: { firmId: string }) {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listOrganisationMembers);
  const transfer = useServerFn(transferOrganisationOwnership);

  const [selected, setSelected] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["organisation-members", firmId],
    queryFn: () => fetchMembers({ data: { firmId } }),
    retry: false,
  });

  if (q.isLoading || !q.data || !q.data.isOwner) return null;

  const candidates = q.data.members.filter(
    (m) => m.userId !== q.data!.currentOwnerUserId && m.userId !== q.data!.meUserId,
  );
  const target = candidates.find((m) => m.userId === selected);
  const nameOf = (m: { displayName: string | null; email: string | null }) =>
    m.displayName || m.email || "this member";

  const doTransfer = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await transfer({ data: { firmId, newOwnerUserId: selected, keepPreviousAsStaff: true } });
      toast.success("Ownership transferred");
      setSelected("");
      await qc.invalidateQueries({ queryKey: ["organisation-members", firmId] });
      qc.invalidateQueries({ queryKey: ["firm-subscription", firmId] });
      qc.invalidateQueries({ queryKey: ["my-firms"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not transfer ownership");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserCog className="h-4 w-4 text-muted-foreground" /> Transfer ownership
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Hand this organisation over to another active member. They take on billing and settings, and
        you stay on as staff — so you keep working access until someone removes you.
      </p>

      {candidates.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          There&apos;s nobody else to hand over to yet. Invite the person first and have them accept
          the invitation, then come back here.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose the new owner" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {nameOf(m)} {m.role === "staff" ? "· staff" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!selected || busy} onClick={() => setConfirming(true)}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Transfer ownership
          </Button>
          <Badge variant="outline" className="text-[10px]">
            You remain as staff
          </Badge>
        </div>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              {target ? nameOf(target) : "This member"} becomes the owner of this organisation and
              can change the plan, manage members and remove access. You&apos;ll be moved to staff
              and will keep access to the organisation&apos;s clients until the new owner removes
              you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void doTransfer(); }} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
