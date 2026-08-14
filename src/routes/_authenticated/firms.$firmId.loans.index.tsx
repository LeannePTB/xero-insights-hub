import { createFileRoute } from "@tanstack/react-router";
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
import {
  ALL_FILES,
  listGroupLoanFiles,
  getGroupLoanReconciliation,
  downloadGroupLoanReconciliation,
  saveGroupLoanSnapshot,
  type ReconRow,
} from "@/lib/loan-consolidation.functions";

export const Route = createFileRoute("/_authenticated/firms/$firmId/loans/")({
  component: LoanMatrixTab,
});

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

function LoanMatrixTab() {
  const { group: groupId } = Route.useSearch();

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

  if (!groupId) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Create a consolidation group first, then pick it above.
      </p>
    );
  }

  const sections = recon?.files ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Xero file
          </label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILES}>All Xero files</SelectItem>
              {files.map((f) => (
                <SelectItem key={f.tenantId} value={f.tenantId}>
                  {f.clientName} — {f.tenantName} ({f.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            As at
          </label>
          <Input type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportMut.mutate("pdf")} disabled={exportMut.isPending}>
            {exportMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportMut.mutate("xlsx")} disabled={exportMut.isPending}>
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save report
          </Button>
        </div>
      </div>

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
          No loan accounts set up for this group yet. Use the Loan accounts tab to add or auto-detect them.
        </p>
      )}

      {sections.map((file: any) => (
        <section key={file.tenant.tenantId} className="space-y-2">
          <h2 className="font-display text-base font-semibold">
            {file.tenant.clientName ?? file.tenant.tenantName}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{file.tenant.tenantName}</span>
          </h2>
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
                {file.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No loan accounts configured for this Xero file.
                    </TableCell>
                  </TableRow>
                )}
                {file.rows.map((row: ReconRow) => {
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
                        {row.account.error && <p className="text-xs text-destructive">{row.account.error}</p>}
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
        </section>
      ))}

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
