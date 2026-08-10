import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getLoanReconciliation,
  listClientTenantsWithAccounts,
  type ReconRow,
} from "@/lib/loan-consolidation.functions";
import { getClient } from "@/lib/clients.functions";
import { buildXeroAccountLink } from "@/lib/xero/loan-account-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { MismatchDetailDialog } from "@/components/loan/MismatchDetailDialog";
import { ArrowLeft, Loader2, ExternalLink, Settings2, AlertTriangle } from "lucide-react";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_BADGE: Record<ReconRow["status"], { label: string; cls: string }> = {
  balanced: { label: "Balanced", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  mismatch: { label: "Mismatch", cls: "bg-destructive/10 text-destructive" },
  unpaired: { label: "Unpaired", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  missing: { label: "Missing", cls: "bg-muted text-muted-foreground" },
};

export const Route = createFileRoute("/_authenticated/clients/$clientId/loans")({
  head: () => ({ meta: [{ title: "Loan Consolidation — Traction Advisory" }] }),
  component: LoansPage,
});

function LoansPage() {
  const { clientId } = Route.useParams();
  const qc = useQueryClient();

  const fetchClient = useServerFn(getClient);
  const fetchTenants = useServerFn(listClientTenantsWithAccounts);
  const fetchRecon = useServerFn(getLoanReconciliation);

  const clientQ = useQuery({ queryKey: ["client", clientId], queryFn: () => fetchClient({ data: { clientId } }) });
  const tenantsQ = useQuery({
    queryKey: ["loan-tenants-with-accounts", clientId],
    queryFn: () => fetchTenants({ data: { clientId } }),
  });
  const tenants = tenantsQ.data?.tenants ?? [];

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [asAt, setAsAt] = useState<string>(todayISO());
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!tenantId && tenants.length > 0) setTenantId(tenants[0].tenantId);
  }, [tenants, tenantId]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`loan-asAt-${clientId}`);
      if (saved) setAsAt(saved);
    } catch {
      /* ignore */
    }
  }, [clientId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`loan-asAt-${clientId}`, asAt);
    } catch {
      /* ignore */
    }
  }, [asAt, clientId]);

  const reconQ = useQuery({
    queryKey: ["loan-recon", clientId, tenantId, asAt],
    queryFn: () => fetchRecon({ data: { clientId, tenantId, asAt } }),
    enabled: !!tenantId,
  });

  const result = reconQ.data;
  const rows = result?.rows ?? [];

  const selectedTenantName = tenants.find((t) => t.tenantId === tenantId)?.tenantName ?? "";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
              <Link to="/clients/$clientId" params={{ clientId }}>
                <ArrowLeft className="mr-1 h-4 w-4" /> {clientQ.data?.client?.name ?? "Client"}
              </Link>
            </Button>
            <h1 className="font-display text-2xl font-semibold">Company Loan Consolidation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reconciles the loan account in each Xero file against its paired loan account.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/clients/$clientId/loans-accounts" params={{ clientId }}>
              <Settings2 className="mr-2 h-4 w-4" /> Set up accounts
            </Link>
          </Button>
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
                    {t.tenantName} ({t.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">As at</span>
            <Input type="date" className="w-44" value={asAt} onChange={(e) => setAsAt(e.target.value)} />
          </div>
        </div>

        {tenantsQ.isLoading && (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {!tenantsQ.isLoading && tenants.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center">
            <h3 className="font-display text-lg font-semibold">No loan accounts set up yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Open "Set up accounts" to choose which chart-of-accounts accounts are the loans, then
              pair the loan in each Xero file with its counterpart.
            </p>
            <Button className="mt-5" asChild>
              <Link to="/clients/$clientId/loans-accounts" params={{ clientId }}>
                <Settings2 className="mr-2 h-4 w-4" /> Set up accounts
              </Link>
            </Button>
          </div>
        )}

        {reconQ.isLoading && tenantId && (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reconciling {selectedTenantName || ""} with Xero…
          </div>
        )}

        {reconQ.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> Couldn't run the reconciliation
            </div>
            {String(reconQ.error instanceof Error ? reconQ.error.message : reconQ.error)}
          </div>
        )}

        {result && !reconQ.isError && (
          <>
            {result.tenantErrors.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                {result.tenantErrors.map((e) => (
                  <div key={e.tenantId} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e.error}
                  </div>
                ))}
              </div>
            )}

            {rows.length === 0 ? (
              <p className="py-10 text-sm text-muted-foreground">
                No loan accounts configured for this Xero file.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Counterparty</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const badge = STATUS_BADGE[row.status];
                      const accountHref = buildXeroAccountLink(row.account.shortCode, row.account.accountId);
                      return (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() => {
                            if (row.status !== "unpaired") {
                              setActiveRow(row.id);
                              setDialogOpen(true);
                            }
                          }}
                        >
                          <TableCell>
                            <p className="font-medium">
                              {row.account.accountCode ? `${row.account.accountCode} · ` : ""}
                              {row.account.accountName || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">{row.account.tenantName}</p>
                            {row.account.error && (
                              <p className="text-xs text-destructive">{row.account.error}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(row.account.balance)}</TableCell>
                          <TableCell>
                            {row.counterparty ? (
                              <>
                                <p className="text-sm">
                                  {row.counterparty.accountCode ? `${row.counterparty.accountCode} · ` : ""}
                                  {row.counterparty.accountName || "Unknown"}
                                </p>
                                <p className="text-xs text-muted-foreground">{row.counterparty.tenantName}</p>
                                {row.counterparty.error && (
                                  <p className="text-xs text-destructive">{row.counterparty.error}</p>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not paired</span>
                            )}
                          </TableCell>
                          <TableCell
                            className={
                              "text-right tabular-nums font-semibold " +
                              (Math.abs(row.net) <= 0.01 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")
                            }
                          >
                            {fmt(row.net)}
                          </TableCell>
                          <TableCell>
                            <Badge className={badge.cls}>{badge.label}</Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {accountHref && (
                              <a
                                href={accountHref}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                                title="Open in Xero"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </main>

      <MismatchDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        rowId={activeRow}
        asAt={asAt}
      />
    </div>
  );
}
