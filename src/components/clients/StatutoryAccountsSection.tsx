import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

const TICKABLE: StatutoryCategory[] = ["gst", "payg", "super", "none"];

function describe(stored: StatutoryCategory[], detected: StatutoryCategory | null): string {
  if (stored.includes("none")) return "Set by a person: this account is not GST, PAYG or super.";
  if (stored.length > 1) {
    return `Set by a person to ${stored
      .map((c) => CATEGORY_LABELS[c].toLowerCase())
      .join(" and ")} — reported as one amount, not split.`;
  }
  if (stored.length === 1) return `Set by a person to ${CATEGORY_LABELS[stored[0]].toLowerCase()}.`;
  if (detected) return `Recognised automatically as ${CATEGORY_LABELS[detected].toLowerCase()}.`;
  return "Not treated as GST, PAYG or super.";
}

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
    mutationFn: (v: { accountName: string; categories: StatutoryCategory[] }) =>
      save({ data: { clientId, tenantId: tenantId as string, ...v } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["statutory-accounts", clientId, tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save that."),
  });

  const toggle = (
    accountName: string,
    stored: StatutoryCategory[],
    category: StatutoryCategory,
    ticked: boolean,
  ) => {
    let next: StatutoryCategory[];
    if (!ticked) {
      next = stored.filter((c) => c !== category);
    } else if (category === "none") {
      // "None of these" is a decision on its own; it cannot sit beside a category.
      next = ["none"];
    } else {
      next = [...stored.filter((c) => c !== "none"), category];
      if (category === "super") next = next.filter((c) => c === "super");
      else next = next.filter((c) => c !== "super");
    }
    mut.mutate({ accountName, categories: next });
  };

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
        it holds here, and that is what we use. Tick nothing to leave it to us.
      </p>
      <p className="text-sm text-muted-foreground">
        One account can hold more than one thing. If the same account is used for GST and PAYG
        withholding, tick both: we then report that balance as a single amount owed to the ATO,
        because nothing in the file says how much of it is which.
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
          {q.data.rows.map((row) => (
            <li
              key={row.accountId}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.accountName}</p>
                <p className="text-xs text-muted-foreground">
                  {describe(row.stored, row.detected)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {TICKABLE.map((cat) => {
                  const id = `stat-${row.accountId}-${cat}`;
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={row.stored.includes(cat)}
                        disabled={mut.isPending}
                        onCheckedChange={(v) =>
                          toggle(row.accountName, row.stored, cat, v === true)
                        }
                      />
                      <Label htmlFor={id} className="text-xs font-normal">
                        {CATEGORY_LABELS[cat]}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {mut.isPending ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Superannuation is owed to employees' funds, not the ATO, so it cannot be ticked alongside
        GST or PAYG withholding — ticking it clears the others. If super really does share an
        account with ATO amounts, leave all four unticked and tell us: we would rather report the
        balance as unidentified than put it under the wrong heading.
      </p>
    </div>
  );
}
