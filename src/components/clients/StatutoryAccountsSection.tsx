import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listStatutoryAccounts,
  setStatutoryAccount,
  type StatutoryCategory,
} from "@/lib/statutory-accounts.functions";

const CATEGORY_LABELS: Record<StatutoryCategory, string> = {
  gst: "GST",
  payg: "PAYG withholding",
  super: "Superannuation",
  none: "None of these",
};

const AUTO = "__auto__";

export function StatutoryAccountsSection({
  clientId,
  tenantId,
}: {
  clientId: string;
  tenantId?: string;
}) {
  const list = useServerFn(listStatutoryAccounts);
  const save = useServerFn(setStatutoryAccount);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["statutory-accounts", clientId, tenantId],
    enabled: Boolean(tenantId),
    queryFn: () => list({ data: { clientId, tenantId: tenantId as string } }),
  });

  const mut = useMutation({
    mutationFn: (v: { accountName: string; category: StatutoryCategory | null }) =>
      save({ data: { clientId, tenantId: tenantId as string, ...v } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["statutory-accounts", clientId, tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save that."),
  });

  if (!tenantId) {
    return (
      <p className="text-sm text-muted-foreground">
        Link a Xero file to this client first — the accounts come from the file.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We work out which accounts hold GST, PAYG withholding and super from the account name. Where
        this client names an account differently — an ATO suspense account, for instance — say what
        it holds here, and that is what we use.
      </p>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Reading the accounts on this file…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">
          The accounts could not be read from Xero, so nothing can be set here right now.
        </p>
      ) : !q.data?.rows.length ? (
        <p className="text-sm text-muted-foreground">This file has no active liability accounts.</p>
      ) : (
        <ul className="space-y-1.5">
          {q.data.rows.map((row) => {
            const effective = row.stored ?? row.detected;
            return (
              <li
                key={row.accountId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <div className="min-w-0">
                  <Label htmlFor={`stat-${row.accountId}`} className="text-sm font-medium">
                    {row.accountName}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {row.stored
                      ? `Set by a person to ${CATEGORY_LABELS[row.stored].toLowerCase()}.`
                      : row.detected
                        ? `Recognised automatically as ${CATEGORY_LABELS[row.detected].toLowerCase()}.`
                        : "Not treated as GST, PAYG or super."}
                  </p>
                </div>
                <Select
                  value={row.stored ?? AUTO}
                  onValueChange={(v) =>
                    mut.mutate({
                      accountName: row.accountName,
                      category: v === AUTO ? null : (v as StatutoryCategory),
                    })
                  }
                  disabled={mut.isPending}
                >
                  <SelectTrigger id={`stat-${row.accountId}`} className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO}>
                      Work it out for us
                      {effective && !row.stored ? ` (${CATEGORY_LABELS[effective]})` : ""}
                    </SelectItem>
                    {(Object.keys(CATEGORY_LABELS) as StatutoryCategory[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {CATEGORY_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>
      )}

      {mut.isPending ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        An account can only hold one of these. If a single account is used for GST and PAYG
        together, the amounts cannot be told apart, so leave it on{" "}
        <strong>Work it out for us</strong> rather than pick one.
      </p>
    </div>
  );
}
