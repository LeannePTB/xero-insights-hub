import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listClientTenants,
  listSelectedAccounts,
  listLiabilityAccountsForTenant,
  addLoanAccount,
  updateLoanAccount,
  pairLoanAccounts,
  unpairLoanAccount,
  deleteLoanAccount,
  type LoanAccountRow,
} from "@/lib/loan-consolidation.functions";
import { getClient } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Link2, Unlink, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/$clientId/loans-accounts")({
  head: () => ({ meta: [{ title: "Loan accounts — Traction Advisory" }] }),
  component: LoansAccountsPage,
});

function LoansAccountsPage() {
  const { clientId } = Route.useParams();
  const qc = useQueryClient();

  const fetchClient = useServerFn(getClient);
  const fetchTenants = useServerFn(listClientTenants);
  const fetchAccounts = useServerFn(listSelectedAccounts);
  const fetchLiabilityAccounts = useServerFn(listLiabilityAccountsForTenant);
  const add = useServerFn(addLoanAccount);
  const update = useServerFn(updateLoanAccount);
  const pair = useServerFn(pairLoanAccounts);
  const unpair = useServerFn(unpairLoanAccount);
  const del = useServerFn(deleteLoanAccount);

  const clientQ = useQuery({ queryKey: ["client", clientId], queryFn: () => fetchClient({ data: { clientId } }) });
  const tenantsQ = useQuery({ queryKey: ["loan-tenants", clientId], queryFn: () => fetchTenants({ data: { clientId } }) });
  const tenants = tenantsQ.data?.tenants ?? [];

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!tenantId && tenants.length > 0) setTenantId(tenants[0].tenantId);
  }, [tenants, tenantId]);

  const accountsQ = useQuery({
    queryKey: ["loan-accounts", clientId],
    queryFn: () => fetchAccounts({ data: { clientId } }),
  });
  const rows = accountsQ.data?.rows ?? [];
  const visibleRows = tenantId ? rows.filter((r) => r.tenant_id === tenantId) : rows;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["loan-accounts", clientId] });
    qc.invalidateQueries({ queryKey: ["loan-tenants-with-accounts", clientId] });
  };

  const addMut = useMutation({
    mutationFn: (v: {
      accountId: string;
      accountCode: string | null;
      accountName: string | null;
      accountType: string | null;
      direction: "payable" | "receivable";
    }) => add({ data: { clientId, tenantId: tenantId!, ...v, sortOrder: 0 } }),
    onSuccess: () => {
      toast.success("Loan account added");
      setAddOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (v: { id: string; direction: "payable" | "receivable" }) => update({ data: { id: v.id, direction: v.direction } }),
    onSuccess: () => invalidate(),
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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedArray = Array.from(selected);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
              <Link to="/clients/$clientId/loans" params={{ clientId }}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Loan Consolidation
              </Link>
            </Button>
            <h1 className="font-display text-2xl font-semibold">Set up loan accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {clientQ.data?.client?.name ?? "Client"} — choose the loan account in each Xero file and
              pair it with its counterpart.
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Select value={tenantId ?? undefined} onValueChange={(v) => setTenantId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a Xero file" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.tenantId} value={t.tenantId}>
                    {t.tenantName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={() => setAddOpen(true)}
            disabled={!tenantId}
          >
            <Plus className="mr-2 h-4 w-4" /> Add account
          </Button>
          {selectedArray.length === 2 && (
            <Button onClick={() => pairMut.mutate([selectedArray[0], selectedArray[1]])} disabled={pairMut.isPending}>
              {pairMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Pair selected
            </Button>
          )}
          {selectedArray.length > 2 && (
            <p className="text-xs text-muted-foreground">Select exactly two accounts to pair.</p>
          )}
        </div>

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
              {accountsQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
                  </TableCell>
                </TableRow>
              )}
              {!accountsQ.isLoading && visibleRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No loan accounts set up for this Xero file yet.
                  </TableCell>
                </TableRow>
              )}
              {visibleRows.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  checked={selected.has(row.id)}
                  onToggle={() => toggle(row.id)}
                  onDirection={(d) => updateMut.mutate({ id: row.id, direction: d })}
                  onUnpair={() => unpairMut.mutate(row.id)}
                  onDelete={() => deleteMut.mutate(row.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      <AddAccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tenantId={tenantId}
        fetchLiabilityAccounts={fetchLiabilityAccounts}
        addMut={addMut}
      />
    </div>
  );
}

function Row({
  row,
  checked,
  onToggle,
  onDirection,
  onUnpair,
  onDelete,
}: {
  row: LoanAccountRow;
  checked: boolean;
  onToggle: () => void;
  onDirection: (d: "payable" | "receivable") => void;
  onUnpair: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow className={checked ? "bg-accent/40" : undefined}>
      <TableCell>
        <Checkbox checked={checked} onCheckedChange={onToggle} />
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
        <Select value={row.direction} onValueChange={(v) => onDirection(v as "payable" | "receivable")}>
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
            <Button variant="ghost" size="sm" onClick={onUnpair} title="Unpair">
              <Unlink className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete} title="Remove">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AddAccountDialog({
  open,
  onOpenChange,
  tenantId,
  fetchLiabilityAccounts,
  addMut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
  fetchLiabilityAccounts: any;
  addMut: any;
}) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"payable" | "receivable">("payable");
  const [query, setQuery] = useState("");

  const accountsQ = useQuery({
    queryKey: ["loan-liability-accounts", tenantId],
    queryFn: () => fetchLiabilityAccounts({ data: { clientId: "", tenantId: tenantId! } }),
    enabled: open && !!tenantId,
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

          <Select value={accountId ?? undefined} onValueChange={(v) => setAccountId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {accountsQ.isLoading && <SelectItem value="__loading">Loading…</SelectItem>}
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
