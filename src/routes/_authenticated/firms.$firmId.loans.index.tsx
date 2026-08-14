import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ExternalLink, FileDown, Save, AlertTriangle } from "lucide-react";
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
import { buildXeroAccountLink } from "@/lib/xero/loan-account-link";
import { listConsolidationGroups } from "@/lib/consolidation-groups.functions";
import {
  ALL_FILES,
  listGroupLoanFiles,
  getGroupLoanReconciliation,
  downloadGroupLoanReconciliation,
  saveGroupLoanSnapshot,
  type ReconRow,
  type ReconRowSide,
} from "@/lib/loan-consolidation.functions";

export const Route = createFileRoute("/_authenticated/firms/$firmId/loans/")({
  component: LoanMatrixTab,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Hub style: plain number, negatives in brackets. */
function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const s = Math.abs(n).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `(${s})` : s;
}

function dirLabel(side: ReconRowSide | null): string {
  if (!side) return "";
  return (side.actualDirection ?? side.direction) === "receivable" ? "R" : "P";
}

const STATUS_BADGE: Record<ReconRow["status"], { label: string; cls: string }> = {
  balanced: {
    label: "Balanced",
    cls: "border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  mismatch: {
    label: "Mismatch",
    cls: "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/10",
  },
  unpaired: {
    label: "Unpaired",
    cls: "border-transparent bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300",
  },
  missing: { label: "Missing", cls: "border-transparent bg-muted text-muted-foreground" },
};


function download(base64: string, filename: string, mimeType: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function XeroLink({ side }: { side: ReconRowSide }) {
  const href = buildXeroAccountLink(side.shortCode, side.accountId);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="ml-1 inline-flex text-muted-foreground hover:text-foreground"
      title="Open in Xero"
    >
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function LoanMatrixTab() {
  const { firmId } = Route.useParams();
  const { group: groupId } = Route.useSearch();
  const navigate = useNavigate();

  const fetchGroups = useServerFn(listConsolidationGroups);
  const fetchFiles = useServerFn(listGroupLoanFiles);
  const fetchRecon = useServerFn(getGroupLoanReconciliation);
  const exportFn = useServerFn(downloadGroupLoanReconciliation);
  const saveFn = useServerFn(saveGroupLoanSnapshot);

  const [tenantId, setTenantId] = useState<string>(ALL_FILES);
  const [asAt, setAsAt] = useState<string>(todayISO());
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setTenantId(ALL_FILES);
  }, [groupId]);

  const groupsQ = useQuery({
    queryKey: ["consolidation-groups", firmId],
    queryFn: () => fetchGroups({ data: { firmId } }),
  });
  const groups = groupsQ.data?.groups ?? [];

  const filesQ = useQuery({
    queryKey: ["group-loan-files", groupId],
    queryFn: () => fetchFiles({ data: { groupId: groupId! } }),
    enabled: !!groupId,
  });
  const files = filesQ.data?.files ?? [];

  const reconQ = useQuery({
    queryKey: ["group-loan-recon", groupId, tenantId, asAt],
    queryFn: () => fetchRecon({ data: { groupId: groupId!, tenantId, asAt } }),
    enabled: !!groupId,
  });
  const recon = reconQ.data;

  const exportMut = useMutation({
    mutationFn: (format: "pdf" | "xlsx") =>
      exportFn({ data: { groupId: groupId!, tenantId, asAt, format } }),
    onSuccess: (r: any) => download(r.base64, r.filename, r.mimeType),
    onError: (e: any) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { groupId: groupId!, tenantId, asAt } }),
    onSuccess: () => toast.success("Report saved"),
    onError: (e: any) => toast.error(e.message),
  });

  // Unpaired accounts are excluded from the matrix — pair them on the Accounts tab.
  const sections = (recon?.files ?? [])
    .map((f: any) => ({ ...f, rows: f.rows.filter((r: ReconRow) => r.status !== "unpaired") }))
    .filter((f: any) => f.rows.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold text-primary">Loan Consolidation</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Pick a Xero file to reconcile its selected loan accounts against the counterparty file and
            account configured in the Accounts tab.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportMut.mutate("pdf")} disabled={exportMut.isPending || !groupId}>
              {exportMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportMut.mutate("xlsx")} disabled={exportMut.isPending || !groupId}>
              <FileDown className="mr-2 h-4 w-4" /> Download Excel
            </Button>
          </div>
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !groupId}>
            {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Group
          </label>
          <Select
            value={groupId}
            onValueChange={(v) =>
              navigate({ to: "/firms/$firmId/loans", params: { firmId }, search: { group: v } })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={groupsQ.isLoading ? "Loading…" : "No groups yet"} />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Xero file
          </label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILES}>All Xero files ({files.length} files)</SelectItem>
              {files.map((f) => (
                <SelectItem key={f.tenantId} value={f.tenantId}>
                  {f.clientName} — {f.tenantName} ({f.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:w-52">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Balance as at
          </label>
          <Input type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} />
        </div>
      </div>

      {!groupId && (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Create a consolidation group first, then pick it above.
        </p>
      )}

      {reconQ.isLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading balances from Xero…
        </p>
      )}
      {reconQ.error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {(reconQ.error as Error).message}
        </p>
      )}

      {recon && sections.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          No loan accounts set up for this group yet. Use the Accounts tab to pair them.
        </p>
      )}

      {sections.map((file: any) => {
        const totalNet = file.rows.reduce((s: number, r: ReconRow) => s + (r.net ?? 0), 0);
        const hasErrors = file.tenantErrors && file.tenantErrors.length > 0;
        return (
          <section key={file.tenant.tenantId} className="space-y-2">
            <h3 className="font-display text-lg font-semibold text-primary">
              {file.tenant.clientName ?? file.tenant.tenantName}
              <span className="ml-2 text-sm font-normal text-muted-foreground">{file.tenant.tenantName}</span>
            </h3>

            {hasErrors && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="space-y-1">
                    <p className="font-medium text-destructive">Couldn’t load balances for this Xero file</p>
                    {file.tenantErrors.map((e: any) => (
                      <p
                        key={e.tenantId}
                        className="text-xs text-destructive/90"
                        title={e.error}
                      >
                        {e.error.length > 120 ? `${e.error.slice(0, 120)}…` : e.error}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-primary/5 hover:bg-primary/5">
                    <TableHead className="text-base font-semibold text-foreground">This file — Account</TableHead>
                    <TableHead className="text-right text-base font-semibold text-foreground">Balance</TableHead>
                    <TableHead className="w-10 text-base font-semibold text-foreground">Dir</TableHead>
                    <TableHead className="border-l border-border text-base font-semibold text-foreground">Counterparty</TableHead>
                    <TableHead className="text-right text-base font-semibold text-foreground">Balance</TableHead>
                    <TableHead className="w-10 text-base font-semibold text-foreground">Dir</TableHead>
                    <TableHead className="border-l border-border text-right text-base font-semibold text-foreground">Net</TableHead>
                    <TableHead className="text-base font-semibold text-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {file.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        No loan accounts configured for this Xero file.
                      </TableCell>
                    </TableRow>
                  )}
                  {file.rows.map((row: ReconRow) => {
                    const badge = STATUS_BADGE[row.status];
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
                            <XeroLink side={row.account} />
                          </p>
                          {row.account.error && (
                            <p className="max-w-xs truncate text-xs text-destructive" title={row.account.error}>
                              {row.account.error}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(row.account.balance)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{dirLabel(row.account)}</TableCell>
                        <TableCell className="border-l border-border">
                          {row.counterparty ? (
                            <>
                              <p className="text-sm font-medium">{row.counterparty.tenantName}</p>
                              <p className="text-sm text-muted-foreground">
                                {row.counterparty.accountCode ? `${row.counterparty.accountCode} · ` : ""}
                                {row.counterparty.accountName || "Unknown"}
                                <XeroLink side={row.counterparty} />
                              </p>
                              {row.counterparty.error && (
                                <p className="max-w-xs truncate text-xs text-destructive" title={row.counterparty.error}>
                                  {row.counterparty.error}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not paired</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.counterparty ? num(row.counterparty.balance) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{dirLabel(row.counterparty)}</TableCell>
                        <TableCell
                          className={
                            "border-l border-border text-right tabular-nums font-semibold " +
                            (Math.abs(row.net) <= 0.01 ? "" : "text-destructive")
                          }
                        >
                          {num(row.net)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${badge.cls} uppercase tracking-wide`}>{badge.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {file.rows.length > 0 && (
                    <TableRow className="border-t-2 border-primary/40 hover:bg-transparent">
                      <TableCell colSpan={6} />
                      <TableCell className="border-l border-border text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Total net
                      </TableCell>
                      <TableCell className="tabular-nums font-semibold">{num(totalNet)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}

      <MismatchDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        groupId={groupId}
        rowId={activeRow}
        asAt={asAt}
      />
    </div>
  );
}
