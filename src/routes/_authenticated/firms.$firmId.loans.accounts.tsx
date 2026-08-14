import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Link2, Unlink, Trash2, Plus, Search, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  listGroupLoanFiles,
  listSelectedAccounts,
  listLiabilityAccountsForTenant,
  addLoanAccount,
  updateLoanAccount,
  pairLoanAccounts,
  unpairLoanAccount,
  deleteLoanAccount,
  autoSetupGroupLoanAccounts,
  type LoanAccountRow,
} from "@/lib/loan-consolidation.functions";

export const Route = createFileRoute("/_authenticated/firms/$firmId/loans/accounts")({
  component: LoanAccountsTab,
});

function LoanAccountsTab() {
  const { group: groupId } = Route.useSearch();
  const qc = useQueryClient();

  const fetchFiles = useServerFn(listGroupLoanFiles);
  const fetchAccounts = useServerFn(listSelectedAccounts);
  const fetchLiabilityAccounts = useServerFn(listLiabilityAccountsForTenant);
  const add = useServerFn(addLoanAccount);
  const update = useServerFn(updateLoanAccount);
  const pair = useServerFn(pairLoanAccounts);
  const unpair = useServerFn(unpairLoanAccount);
  const del = useServerFn(deleteLoanAccount);
  const autoSetup = useServerFn(autoSetupGroupLoanAccounts);

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);

  const filesQ = useQuery({
    queryKey: ["group-loan-files", groupId],
    queryFn: () => fetchFiles({ data: { groupId: groupId! } }),
    enabled: !!groupId,
  });
  const files = filesQ.data?.files ?? [];
  const clientIds = useMemo(() => [...new Set(files.map((f) => f.clientId))], [files]);

  useEffect(() => {
    if (!tenantId && files.length > 0) setTenantId(files[0].tenantId);
  }, [files, tenantId]);

  const accountQueries = useQueries({
    queries: clientIds.map((clientId) => ({
      queryKey: ["loan-accounts", clientId],
      queryFn: () => fetchAccounts({ data: { clientId } }),
    })),
  });
  const loading = accountQueries.some((q) => q.isLoading);
  const rows: LoanAccountRow[] = accountQueries.flatMap((q) => (q.data as any)?.rows ?? []);
  const visibleRows = tenantId ? rows.filter((r) => r.tenant_id === tenantId) : rows;
  const activeFile = files.find((f) => f.tenantId === tenantId);

  const invalidate = () => {
    for (const clientId of clientIds) qc.invalidateQueries({ queryKey: ["loan-accounts", clientId] });
    qc.invalidateQueries({ queryKey: ["group-loan-files", groupId] });
    qc.invalidateQueries({ queryKey: ["group-loan-recon", groupId] });
  };

  const addMut = useMutation({
    mutationFn: (v: {
      accountId: string;
      accountCode: string | null;
      accountName: string | null;
      accountType: string | null;
      direction: "payable" | "receivable";
    }) =>
      add({
        data: { clientId: activeFile!.clientId, tenantId: tenantId!, ...v, sortOrder: 0 },
      }),
    onSuccess: () => {
      toast.success("Loan account added");
      setAddOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (v: { id: string; direction: "payable" | "receivable" }) =>
      update({ data: { id: v.id, direction: v.direction } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const pairMut = useMutation({
    mutationFn: (ids: [string, string]) => pair({ data: { a: ids[0], b: ids[1] } }),
    onSuccess: () => {
      toast.success("Accounts paired");
      setSelected(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unpairMut = useMutation({
    mutationFn: (id: string) => unpair({ data: { id } }),
    onSuccess: () => {
      toast.success("Unpaired");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const autoMut = useMutation({
    mutationFn: () => autoSetup({ data: { groupId: groupId!, apply: true } }),
    onSuccess: (r: any) => {
      toast.success(`Added ${r.added ?? 0} accounts and paired ${r.paired ?? 0}.`);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!groupId) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Create a consolidation group first, then pick it above.
      </p>
    );
  }

  const selectedArray = [...selected];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Xero file
          </label>
          <Select value={tenantId ?? undefined} onValueChange={setTenantId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a Xero file" />
            </SelectTrigger>
            <SelectContent>
              {files.map((f) => (
                <SelectItem key={f.tenantId} value={f.tenantId}>
                  {f.clientName} — {f.tenantName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => setAddOpen(true)} disabled={!tenantId}>
          <Plus className="mr-2 h-4 w-4" /> Add account
        </Button>
        <Button variant="outline" onClick={() => autoMut.mutate()} disabled={autoMut.isPending}>
          {autoMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Auto-detect from Xero
        </Button>
        {selectedArray.length === 2 && (
          <Button onClick={() => pairMut.mutate([selectedArray[0], selectedArray[1]])} disabled={pairMut.isPending}>
            {pairMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Pair selected
          </Button>
        )}
      </div>

      {selectedArray.length === 1 && (
        <p className="text-xs text-muted-foreground">
          Now switch to the other Xero file and tick its matching loan account to pair them.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Account</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Counterparty</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No loan accounts set up for this Xero file yet.
                </TableCell>
              </TableRow>
            )}
            {visibleRows.map((row) => (
              <TableRow key={row.id} className={selected.has(row.id) ? "bg-accent/40" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.id)) next.delete(row.id);
                        else next.add(row.id);
                        return next;
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  <p className="font-medium">
                    {row.account_code ? `${row.account_code} · ` : ""}
                    {row.account_name || "Unknown"}
                  </p>
                  {row.account_type && <p className="text-xs text-muted-foreground">{row.account_type}</p>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.tenant_name ?? row.tenant_id}</TableCell>
                <TableCell>
                  <Select
                    value={row.direction}
                    onValueChange={(v) => updateMut.mutate({ id: row.id, direction: v as "payable" | "receivable" })}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payable">Payable</SelectItem>
                      <SelectItem value="receivable">Receivable</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {row.counterparty_account_id ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{row.counterparty_name ?? "Paired"}</Badge>
                      {row.counterparty_tenant_name && (
                        <span className="text-xs text-muted-foreground">{row.counterparty_tenant_name}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not paired</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {row.counterparty_account_id && (
                      <Button variant="ghost" size="sm" onClick={() => unpairMut.mutate(row.id)} title="Unpair">
                        <Unlink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(row.id)} title="Remove">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddAccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clientId={activeFile?.clientId ?? null}
        tenantId={tenantId}
        fetchLiabilityAccounts={fetchLiabilityAccounts}
        addMut={addMut}
      />
    </div>
  );
}

function AddAccountDialog({
  open,
  onOpenChange,
  clientId,
  tenantId,
  fetchLiabilityAccounts,
  addMut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  tenantId: string | null;
  fetchLiabilityAccounts: any;
  addMut: any;
}) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"payable" | "receivable">("payable");
  const [query, setQuery] = useState("");

  const accountsQ = useQuery({
    queryKey: ["loan-liability-accounts", clientId, tenantId],
    queryFn: () => fetchLiabilityAccounts({ data: { clientId: clientId!, tenantId: tenantId! } }),
    enabled: open && !!tenantId && !!clientId,
  });

  useEffect(() => {
    if (open) {
      setAccountId(null);
      setQuery("");
    }
  }, [open]);

  const accounts = (accountsQ.data?.accounts ?? []).filter((a: any) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (a.name ?? "").toLowerCase().includes(q) ||
      (a.code ?? "").toLowerCase().includes(q) ||
      (a.type ?? "").toLowerCase().includes(q)
    );
  });

  const chosen = accounts.find((a: any) => a.accountId === accountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add loan account</DialogTitle>
          <DialogDescription>
            Pick the chart-of-accounts account that represents this company's loan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name or type"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Select value={accountId ?? undefined} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {accounts.map((a: any) => (
                <SelectItem key={a.accountId ?? a.code} value={a.accountId ?? a.code}>
                  {a.code ? `${a.code} · ` : ""}
                  {a.name}
                </SelectItem>
              ))}
              {!accountsQ.isLoading && accounts.length === 0 && (
                <SelectItem value="__none" disabled>
                  No matching accounts
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          <div className="space-y-1.5">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as "payable" | "receivable")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payable">Payable (this company owes)</SelectItem>
                <SelectItem value="receivable">Receivable (this company is owed)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => {
              if (!chosen) return;
              addMut.mutate({
                accountId: chosen.accountId,
                accountCode: chosen.code,
                accountName: chosen.name,
                accountType: chosen.type,
                direction,
              });
            }}
            disabled={!chosen || addMut.isPending}
          >
            {addMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
