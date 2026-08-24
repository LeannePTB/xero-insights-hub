import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteMonthlyReport,
  finaliseMonthlyReport,
  listMonthlyReportRecipients,
  revokeMonthlyReportRecipient,
  sendMonthlyReport,
} from "@/lib/reports/report-delivery.functions";
import { getStoredMonthlyReport } from "@/lib/reports/monthly-report.functions";
import { MONTHLY_REPORT_PAYLOAD_VERSION } from "@/lib/reports/monthly-report";

export type ReportRow = {
  id: string;
  status: string;
  version: number;
  period_end: string;
  title?: string | null;
  complete?: boolean | null;
  payload_version?: number | null;
};

/** A payload written by superseded logic — its figures have since been corrected. */
export function isStalePayload(report: { payload_version?: number | null } | null | undefined) {
  if (!report) return false;
  return Number(report.payload_version ?? 0) < MONTHLY_REPORT_PAYLOAD_VERSION;
}

function money(n: number | null | undefined, currency: string) {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency || "AUD",
    minimumFractionDigits: 2,
  }).format(Math.abs(n));
  return n < 0 ? `(${s})` : s;
}

/**
 * Finalising freezes both the figures and the PDF permanently, so it is a
 * deliberate act: the headline figures are shown one last time, and a stale or
 * incomplete payload is refused here as well as in the server function.
 */
export function FinaliseReportDialog({
  report,
  clientId,
  onClose,
  onRegenerate,
}: {
  report: ReportRow | null;
  clientId: string;
  onClose: () => void;
  onRegenerate?: (report: ReportRow) => void;
}) {
  const qc = useQueryClient();
  const finaliseFn = useServerFn(finaliseMonthlyReport);
  const openFn = useServerFn(getStoredMonthlyReport);
  const storedQ = useQuery({
    queryKey: ["stored-report", report?.id],
    queryFn: () => openFn({ data: { reportId: report!.id } }),
    enabled: !!report,
  });
  const payload: any = (storedQ.data as any)?.report?.payload ?? null;
  const totals = payload?.profitAndLoss?.totals ?? null;
  const currency = payload?.meta?.currency ?? "AUD";
  const stale = isStalePayload(report);
  const failed: any[] = Array.isArray(payload?.failedSections) ? payload.failedSections : [];
  const incomplete = report?.complete === false || failed.length > 0;
  const blocked = stale || incomplete;

  const mut = useMutation({
    mutationFn: () => finaliseFn({ data: { reportId: report!.id } }),
    onSuccess: () => {
      toast.success("Report finalised. It can now be emailed.");
      qc.invalidateQueries({ queryKey: ["monthly-reports", clientId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalise this report?</DialogTitle>
          <DialogDescription>
            {report ? `Version ${report.version} · period ending ${report.period_end}. ` : ""}
            The figures and the PDF are frozen permanently and can never be regenerated. A
            correction means generating a new version.
          </DialogDescription>
        </DialogHeader>

        {stale && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            This report was calculated with an older version of the report logic (v
            {report?.payload_version ?? 0} versus v{MONTHLY_REPORT_PAYLOAD_VERSION}). Regenerate it
            before finalising.
          </p>
        )}
        {incomplete && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            This report is incomplete
            {failed.length ? ` — ${failed.map((f) => f.section).join(", ")} could not be calculated` : ""}
            . A report with a failed section must not become the permanent record.
          </p>
        )}

        <div className="rounded-lg border border-border p-3 text-sm">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Check these figures once more
          </p>
          {storedQ.isLoading ? (
            <p className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading the stored figures…
            </p>
          ) : totals ? (
            <dl className="space-y-1">
              <div className="flex justify-between">
                <dt>Revenue</dt>
                <dd className="tabular-nums">{money(totals.revenue, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Gross profit</dt>
                <dd className="tabular-nums">{money(totals.grossProfit, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Net profit</dt>
                <dd className="tabular-nums">{money(totals.netProfit, currency)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground">No Profit and Loss figures stored on this report.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {blocked && onRegenerate && report && (
            <Button
              variant="outline"
              onClick={() => {
                onRegenerate(report);
                onClose();
              }}
            >
              Regenerate this period
            </Button>
          )}
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || blocked}>
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Finalise permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function useRecipients(reportId: string | null, enabled: boolean) {
  const listFn = useServerFn(listMonthlyReportRecipients);
  return useQuery({
    queryKey: ["report-recipients", reportId],
    queryFn: () => listFn({ data: { reportId: reportId! } }),
    enabled: !!reportId && enabled,
  });
}

/** Confirm-and-delete. Always calls public.delete_client_report via the RPC. */
export function DeleteReportDialog({
  report,
  clientId,
  onClose,
}: {
  report: ReportRow | null;
  clientId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteMonthlyReport);
  const [reason, setReason] = useState("");
  const isSent = report?.status === "sent";
  const recipientsQ = useRecipients(report?.id ?? null, !!report && isSent);
  const liveLinks = (recipientsQ.data?.recipients ?? []).filter((r: any) => !r.revoked_at).length;

  const mut = useMutation({
    mutationFn: () => deleteFn({ data: { reportId: report!.id, reason: reason || null } }),
    onSuccess: (res: any) => {
      toast.success(
        res.recipientsRevoked > 0
          ? `Report deleted. ${res.recipientsRevoked} recipient link${res.recipientsRevoked === 1 ? "" : "s"} revoked.`
          : "Report deleted.",
      );
      qc.invalidateQueries({ queryKey: ["monthly-reports", clientId] });
      setReason("");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this report?</DialogTitle>
          <DialogDescription>
            {report ? `Version ${report.version} · ${report.period_end}. ` : ""}
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {isSent && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            This report has been sent. Deleting it stops{" "}
            {recipientsQ.isLoading ? "every" : `${liveLinks}`} recipient link
            {liveLinks === 1 ? "" : "s"} working immediately — anyone who opens their email link
            will see only that it is no longer valid. Only a super admin can delete a finalised or
            sent report.
          </p>
        )}
        {report?.status === "final" && (
          <p className="text-sm text-muted-foreground">
            This report is finalised, so only a super admin can delete it.
          </p>
        )}
        <div>
          <Label htmlFor="del-reason">Reason (recorded in the audit log)</Label>
          <Input
            id="del-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Send a finalised report, and manage who it has gone to. */
export function SendReportDialog({
  report,
  clientId,
  onClose,
}: {
  report: ReportRow | null;
  clientId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const sendFn = useServerFn(sendMonthlyReport);
  const revokeFn = useServerFn(revokeMonthlyReportRecipient);
  const [emails, setEmails] = useState("");
  const [days, setDays] = useState(30);
  const recipientsQ = useRecipients(report?.id ?? null, !!report);

  const sendMut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          reportId: report!.id,
          emails: emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean),
          expiresInDays: days,
        },
      }),
    onSuccess: (res: any) => {
      const ok = res.sent.filter((s: any) => s.status === "queued").length;
      toast.success(`${ok} report link${ok === 1 ? "" : "s"} emailed.`);
      setEmails("");
      qc.invalidateQueries({ queryKey: ["report-recipients", report?.id] });
      qc.invalidateQueries({ queryKey: ["monthly-reports", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (recipientId: string) => revokeFn({ data: { recipientId } }),
    onSuccess: () => {
      toast.success("Link revoked. It stops working right away.");
      qc.invalidateQueries({ queryKey: ["report-recipients", report?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const recipients = recipientsQ.data?.recipients ?? [];

  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email this report</DialogTitle>
          <DialogDescription>
            Each recipient gets their own private link. Before the report opens they must confirm
            the address it was sent to, so a forwarded link will not work for someone else.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="send-emails">Email addresses</Label>
            <Input
              id="send-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="owner@example.com, accountant@example.com"
            />
          </div>
          <div>
            <Label htmlFor="send-days">Link expires after (days)</Label>
            <Input
              id="send-days"
              type="number"
              min={1}
              max={180}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-32"
            />
          </div>
          <Button onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !emails.trim()}>
            {sendMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Send
          </Button>
        </div>

        <div className="mt-2 border-t border-border pt-4">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Sent to</h4>
          {recipientsQ.isLoading ? (
            <p className="mt-3 flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : !recipients.length ? (
            <p className="mt-3 text-sm text-muted-foreground">Not sent to anyone yet.</p>
          ) : (
            <div className="mt-3 max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 text-left">Recipient</th>
                    <th className="py-2 text-left">Opened</th>
                    <th className="py-2 text-left">Expires</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-2 pr-3 break-all">{r.email}</td>
                      <td className="py-2 pr-3">
                        {r.open_count > 0
                          ? `${fmt(r.last_opened_at)} (${r.open_count}×)`
                          : "Not yet"}
                      </td>
                      <td className="py-2 pr-3">
                        {r.revoked_at ? (
                          <span className="text-muted-foreground">Revoked</span>
                        ) : (
                          fmt(r.expires_at)
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {!r.revoked_at && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => revokeMut.mutate(r.id)}
                            disabled={revokeMut.isPending}
                          >
                            <XCircle className="mr-1 h-3 w-3" /> Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
