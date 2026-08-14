import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listConsolidationGroups } from "@/lib/consolidation-groups.functions";
import {
  listGroupLoanFiles,
  listGroupLoanPairings,
  listLiabilityAccountsForTenant,
  saveLoanPairing,
  unpairLoanAccount,
  type LoanPair,
} from "@/lib/loan-consolidation.functions";

export const Route = createFileRoute("/_authenticated/firms/$firmId/loans/accounts")({
  component: LoanPairingsTab,
});

type SideState = {
  tenantId: string | null;
  accountId: string | null;
};

const emptySide: SideState = { tenantId: null, accountId: null };

function LoanPairingsTab() {
  const { firmId } = Route.useParams();
  const { group: groupParam } = Route.useSearch();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchGroups = useServerFn(listConsolidationGroups);
  const fetchFiles = useServerFn(listGroupLoanFiles);
  const fetchPairs = useServerFn(listGroupLoanPairings);
  const fetchAccounts = useServerFn(listLiabilityAccountsForTenant);
  const savePair = useServerFn(saveLoanPairing);
  const unpair = useServerFn(unpairLoanAccount);

  const groupsQ = useQuery({
    queryKey: ["consolidation-groups", firmId],
    queryFn: () => fetchGroups({ data: { firmId } }),
  });
  const groups = groupsQ.data?.groups ?? [];
  const groupId = groupParam ?? groups[0]?.id;

  const filesQ = useQuery({
    queryKey: ["group-loan-files", groupId],
    queryFn: () => fetchFiles({ data: { groupId: groupId! } }),
    enabled: !!groupId,
  });
  const files = filesQ.data?.files ?? [];

  const pairsQ = useQuery({
    queryKey: ["group-loan-pairings", groupId],
    queryFn: () => fetchPairs({ data: { groupId: groupId! } }),
    enabled: !!groupId,
  });
  const pairs: LoanPair[] = pairsQ.data?.pairs ?? [];

  const [sideA, setSideA] = useState<SideState>(emptySide);
  const [sideB, setSideB] = useState<SideState>(emptySide);
  const [editing, setEditing] = useState<LoanPair | null>(null);

  const accountsA = useAccountList(fetchAccounts, files, sideA.tenantId);
  const accountsB = useAccountList(fetchAccounts, files, sideB.tenantId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["group-loan-pairings", groupId] });
    qc.invalidateQueries({ queryKey: ["group-loan-files", groupId] });
    qc.invalidateQueries({ queryKey: ["group-loan-recon", groupId] });
  };

  const resetBuilder = () => {
    setSideA(emptySide);
    setSideB(emptySide);
    setEditing(null);
  };

  const buildSide = (side: SideState, list: AccountOption[]) => {
    const file = files.find((f) => f.tenantId === side.tenantId)!;
    const account = list.find((a) => a.accountId === side.accountId);
    return {
      clientId: file.clientId,
      tenantId: file.tenantId,
      accountId: account?.accountId ?? null,
      accountCode: account?.code ?? null,
      accountName: account?.name ?? null,
      accountType: account?.type ?? null,
    };
  };

  const saveMut = useMutation({
    mutationFn: () =>
      savePair({
        data: {
          a: buildSide(sideA, accountsA.options),
          b: buildSide(sideB, accountsB.options),
          replaceIds: editing ? [editing.a.id, editing.b.id] : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Pairing updated" : "Pairing saved");
      resetBuilder();
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (pair: LoanPair) => unpair({ data: { id: pair.a.id } }),
    onSuccess: () => {
      toast.success("Pairing removed");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const canSave =
    !!sideA.tenantId && !!sideA.accountId && !!sideB.tenantId && !!sideB.accountId;

  const startEdit = (pair: LoanPair) => {
    setEditing(pair);
    setSideA({ tenantId: pair.a.tenantId, accountId: pair.a.accountId });
    setSideB({ tenantId: pair.b.tenantId, accountId: pair.b.accountId });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const swap = () => {
    setSideA(sideB);
    setSideB(sideA);
  };

  if (!groupId) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a consolidation group first, then come back to pair loan accounts.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Loan Account Pairings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Match a loan account in one Xero file with its counterparty in another. Both sides show
          the full liability + asset account list so you can line them up.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Group
        </Label>
        <div className="max-w-sm">
          <Select
            value={groupId}
            onValueChange={(v) => {
              resetBuilder();
              navigate({ to: pathname, search: { group: v } });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                  {g.id === groupId && files.length ? ` (${files.length})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {editing ? "Edit pairing" : "Add pairing"}
          </h3>
        </div>


        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <SidePanel
            title="Side A"
            files={files}
            side={sideA}
            onChange={setSideA}
            accounts={accountsA}
          />
          <div className="flex justify-center">
            <Button variant="ghost" size="icon" onClick={swap} aria-label="Swap sides">
              <ArrowLeftRight className="h-5 w-5" />
            </Button>
          </div>
          <SidePanel
            title="Side B"
            files={files}
            side={sideB}
            onChange={setSideB}
            accounts={accountsB}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {editing && (
            <Button variant="ghost" onClick={resetBuilder}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
          )}
          <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>
            {saveMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save pairing
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pairings in this group
          </h3>
          <span className="text-sm text-muted-foreground">
            {pairs.length} pairing{pairs.length === 1 ? "" : "s"}
          </span>
        </div>

        {pairsQ.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading pairings…
          </div>
        ) : pairs.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            No pairings yet. Build one above.
          </p>
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Side A
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Side B
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pairs.map((pair) => (
                <TableRow key={pair.key}>
                  <TableCell className="py-4 align-middle">
                    <div className="font-semibold">{pair.a.tenantName}</div>
                    <div className="text-sm text-muted-foreground">{accountLabel(pair.a)}</div>
                  </TableCell>
                  <TableCell className="py-4 align-middle">
                    <div className="flex items-center gap-3">
                      <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm">
                        {pair.b.tenantName} · {accountLabel(pair.b)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-right align-middle">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => startEdit(pair)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMut.mutate(pair)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

        )}
      </div>
    </div>
  );
}

function accountLabel(side: { accountCode: string | null; accountName: string | null }) {
  return [side.accountCode, side.accountName].filter(Boolean).join(" · ") || "(unnamed account)";
}

type AccountOption = {
  accountId: string | null;
  code: string | null;
  name: string | null;
  type: string | null;
};

type AccountList = { options: AccountOption[]; isLoading: boolean };

function useAccountList(
  fetchAccounts: ReturnType<typeof useServerFn<typeof listLiabilityAccountsForTenant>>,
  files: Array<{ clientId: string; tenantId: string }>,
  tenantId: string | null,
): AccountList {
  const file = files.find((f) => f.tenantId === tenantId);
  const q = useQuery({
    queryKey: ["loan-liability-accounts", file?.clientId, tenantId],
    queryFn: () =>
      fetchAccounts({ data: { clientId: file!.clientId, tenantId: tenantId! } }),
    enabled: !!file && !!tenantId,
  });
  const options = useMemo(
    () => ((q.data?.accounts ?? []) as AccountOption[]).filter((a) => !!a.accountId),
    [q.data],
  );
  return { options, isLoading: q.isLoading };
}

function SidePanel({
  title,
  files,
  side,
  onChange,
  accounts,
}: {
  title: string;
  files: Array<{ clientId: string; tenantId: string; tenantName: string }>;
  side: SideState;
  onChange: (s: SideState) => void;
  accounts: AccountList;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">{title}</div>
      <div className="mt-3 space-y-3">
        <div>
          <Label className="mb-1 block text-sm">Xero file</Label>
          <Select
            value={side.tenantId ?? undefined}
            onValueChange={(v) => onChange({ tenantId: v, accountId: null })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a Xero file" />
            </SelectTrigger>
            <SelectContent>
              {files.map((f) => (
                <SelectItem key={f.tenantId} value={f.tenantId}>
                  {f.tenantName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block text-sm">Loan account</Label>
          <Select
            value={side.accountId ?? undefined}
            onValueChange={(v) => onChange({ ...side, accountId: v })}
            disabled={!side.tenantId || accounts.isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !side.tenantId
                    ? "Pick Xero file first"
                    : accounts.isLoading
                      ? "Loading accounts…"
                      : "Select a loan account"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {accounts.options.map((a) => (
                <SelectItem key={a.accountId!} value={a.accountId!}>
                  {[a.code, a.name].filter(Boolean).join(" · ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
