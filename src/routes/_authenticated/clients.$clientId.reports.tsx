import { useWorkspaceBranding } from "@/hooks/useWorkspaceBranding";
import { ReportSectionsUpsell } from "@/components/billing/ClientCardSetupPanel";
import { useCanManageClient } from "@/hooks/useCanManageClient";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Download, FileText, Loader2, Mail, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getClient } from "@/lib/clients.functions";

import { periodOptions } from "@/components/dashboard/recon-periods";
import {
  generateMonthlyReport,
  getStoredMonthlyReport,
  listMonthlyReports,
} from "@/lib/reports/monthly-report.functions";
import { MonthlyReportPreview } from "@/components/reports/MonthlyReportPreview";
import {
  DeleteReportDialog,
  FinaliseReportDialog,
  SendReportDialog,
  isStalePayload,
  type ReportRow,
} from "@/components/reports/ReportDeliveryDialogs";
import { getMonthlyReportPdfUrl } from "@/lib/reports/report-pdf.functions";
import type { MonthlyReportPayload } from "@/lib/reports/monthly-report";
import { MONTHLY_REPORT_PAYLOAD_VERSION, wasRateLimited } from "@/lib/reports/monthly-report";
import { reportVideoFrom } from "@/lib/reports/report-video";
import { scenarioSnapshotFrom } from "@/lib/scenario/adjustments";
import { ReportVideoEditor, type ReportVideoEditorHandle } from "@/components/reports/ReportVideoEditor";
import { PageContainer } from "@/components/PageContainer";


export const Route = createFileRoute("/_authenticated/clients/$clientId/reports")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Monthly management reports — Traction Advisory" },
      {
        name: "description",
        content:
          "Generate and preview a client's monthly management report — key figures, profit and loss, income versus expenses, receivables and payables.",
      },
      { property: "og:title", content: "Monthly management reports — Traction Advisory" },
      {
        property: "og:description",
        content: "Point-in-time management reporting built from the client's live Xero data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function ReportsPage() {
  const workspaceBrand = useWorkspaceBranding();
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const fetchClient = useServerFn(getClient);

  const listFn = useServerFn(listMonthlyReports);
  const generateFn = useServerFn(generateMonthlyReport);
  const openFn = useServerFn(getStoredMonthlyReport);

  const periods = useMemo(() => periodOptions(), []);
  const [periodEnd, setPeriodEnd] = useState(periods[1]?.value ?? periods[0]?.value ?? "");
  const [tenantId, setTenantId] = useState<string>("");
  const [preview, setPreview] = useState<
    {
      payload: MonthlyReportPayload;
      status: string;
      version: number;
      /** How the preview got here — drives the label above it. */
      source: "generated" | "opened" | "auto";
    } | null
  >(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);


  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient({ data: { clientId } }),
  });
  const listQ = useQuery({
    queryKey: ["monthly-reports", clientId],
    queryFn: () => listFn({ data: { clientId } }),
  });

  const { canManage: isAdvisor } = useCanManageClient(clientId);
  const videoEditor = useRef<ReportVideoEditorHandle>(null);


  const client = clientQ.data?.client as any;
  const orgs: { tenantId: string; tenantName: string }[] = (client?.client_xero_orgs ?? [])
    .map((o: any) => ({
      tenantId: o.xero_connections?.tenant_id as string | undefined,
      tenantName: (o.xero_connections?.tenant_name as string | undefined) ?? "Xero organisation",
    }))
    .filter((o: any) => !!o.tenantId);

  const genMut = useMutation({
    mutationFn: async (override: string | undefined) => {
      if (!override || override === periodEnd) await videoEditor.current?.save();
      return generateFn({ data: { clientId, periodEnd: override ?? periodEnd, tenantId: tenantId || null } });
    },
    onSuccess: (res: any) => {
      setPreview({ payload: res.payload, status: res.status, version: res.version, source: "generated" });
      setSelectedId(res.id ?? null);
      qc.invalidateQueries({ queryKey: ["monthly-reports", clientId] });
      if (res.payload?.complete) toast.success(`Draft version ${res.version} generated`);
      else if (wasRateLimited(res.payload))
        toast.warning(
          "Xero has paused requests for this organisation because too many were sent. Wait about a minute, then generate again.",
        );
      else toast.warning("Generated, but some sections could not be computed");

    },
    onError: (e: any) => toast.error(e.message),
  });

  const openMut = useMutation({
    mutationFn: (vars: { reportId: string; source: "opened" | "auto" }) =>
      openFn({ data: { reportId: vars.reportId } }),
    onSuccess: (res: any, vars) => {
      setPreview({
        payload: res.report.payload,
        status: res.report.status,
        version: res.report.version,
        source: vars.source,
      });
      setSelectedId(res.report.id);
    },
    onError: (e: any, vars) => {
      // A failed auto-load must fall back to the empty state, never an error banner.
      if (vars.source === "opened") toast.error(e.message);
    },
  });

  const reports: any[] = listQ.data?.reports ?? [];
  // The row for the report currently shown. The video columns live on the row,
  // not in the payload, so both the player and the editor read them from here.
  const shownRow = reports.find((r) => r.id === selectedId) ?? null;
  const shownVideo = reportVideoFrom(shownRow);
  const shownStatus = shownRow?.status ?? preview?.status;
  const editorDraft = shownRow?.status === "draft" && shownRow.period_end === periodEnd ? shownRow : undefined;

  // Auto-load the most recent stored report (period_end desc, version desc — the
  // order the list already comes back in). Never recomputes; reads the snapshot only.
  const autoLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!listQ.data) return;
    const stillListed = selectedId && reports.some((r) => r.id === selectedId);
    if (stillListed) return;
    if (selectedId && !stillListed) {
      // The shown report was deleted — fall back to the next most recent.
      setSelectedId(null);
      setPreview(null);
    }
    const latest = reports[0];
    if (!latest) {
      autoLoadedFor.current = null;
      return;
    }
    if (autoLoadedFor.current === latest.id) return;
    autoLoadedFor.current = latest.id;
    openMut.mutate({ reportId: latest.id, source: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQ.data, selectedId]);

  const pdfFn = useServerFn(getMonthlyReportPdfUrl);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const pdfMut = useMutation({
    mutationFn: (report: any) =>
      pdfFn({ data: { reportId: report.id, regenerate: report.status === "draft" } }),
    onSuccess: (res: any) => {
      // Short-lived signed URL — opened immediately and never stored.
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setPdfBusyId(null),
  });

  const [toDelete, setToDelete] = useState<ReportRow | null>(null);
  const [toFinalise, setToFinalise] = useState<ReportRow | null>(null);
  const [toSend, setToSend] = useState<ReportRow | null>(null);



  return (
    <div className="min-h-screen bg-background">
      <PageContainer>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold sm:text-lg">
              Monthly management reports
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdvisor
                ? `${client?.name ?? "Client"} · a report is a point-in-time snapshot; the dashboard stays live.`
                : <>{client?.name ?? "Client"} · a snapshot of your business for the period, prepared by {workspaceBrand.productName}.</>}
            </p>
          </div>
        </div>
        <ReportSectionsUpsell clientId={clientId} />

        {isAdvisor && (
          <section className="mt-5 border-y border-border py-4">
            <h2 className="mb-3 font-display text-base font-semibold">Prepare report</h2>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span>① Period</span>
                <select className="h-8 max-w-full rounded-md border border-border bg-card px-2 text-sm" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}>
                  {periods.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              {orgs.length > 1 && <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                <span>Xero file</span>
                <select className="h-8 max-w-full rounded-md border border-border bg-card px-2 text-sm" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                  <option value="">{orgs[0]?.tenantName} (default)</option>
                  {orgs.map((o) => <option key={o.tenantId} value={o.tenantId}>{o.tenantName}</option>)}
                </select>
              </label>}
            </div>
            <div className="min-w-0">
              <ReportVideoEditor key={`${clientId}:${periodEnd}:${editorDraft?.id ?? "pending"}`} ref={videoEditor}
                clientId={clientId} periodEnd={periodEnd} report={editorDraft}
                onSaved={() => { qc.invalidateQueries({ queryKey: ["monthly-reports", clientId] }); }} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button onClick={() => genMut.mutate(undefined)} disabled={genMut.isPending || !periodEnd}>
                {genMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {genMut.isPending ? "Generating…" : "④ Generate draft"}
              </Button>
              <p className="text-xs text-muted-foreground">Save the message before generating; finalised and sent reports are never overwritten.</p>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">How versions work</summary>
                <p className="mt-2 max-w-xl">Generating refreshes the current draft or creates a new version after finalisation. The message to client is carried into each draft and new version, and locked once finalised. Draft PDFs are watermarked; final PDFs are frozen. Current calculation: v{MONTHLY_REPORT_PAYLOAD_VERSION}.</p>
              </details>
            </div>
          </section>
        )}

        {openMut.isPending && !preview ? (
          <p className="mt-6 flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading the most recent report…</p>
        ) : preview ? (
          <section className="mt-5">
            {isAdvisor && shownRow && <div aria-label="Report steps" className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3 text-sm">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" />{shownStatus === "draft" ? "Draft" : shownStatus === "sent" ? "Sent" : "Finalised"} v{shownRow.version}</span>
              <span aria-hidden="true" className="text-muted-foreground">→</span><span>Check preview</span>
              <span aria-hidden="true" className="text-muted-foreground">→</span>
              <Button size="sm" variant={shownStatus === "draft" ? "default" : "outline"} disabled={shownStatus !== "draft"} onClick={() => setToFinalise(shownRow)}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Finalise</Button>
              <span aria-hidden="true" className="text-muted-foreground">→</span>
              <Button size="sm" variant={shownStatus === "draft" ? "outline" : "default"} disabled={shownStatus === "draft"} onClick={() => setToSend(shownRow)}><Mail className="mr-1.5 h-3.5 w-3.5" />{shownStatus === "sent" ? "Email again" : "Email to client"}</Button>
              <span aria-hidden="true" className="text-muted-foreground">→</span>
              <Button size="sm" variant="outline" disabled={pdfBusyId === shownRow.id} onClick={() => { setPdfBusyId(shownRow.id); pdfMut.mutate(shownRow); }}><Download className="mr-1.5 h-3.5 w-3.5" />PDF</Button>
            </div>}
            <MonthlyReportPreview payload={preview.payload} status={shownStatus ?? preview.status} version={preview.version}
              showWarnings={isAdvisor} showWorkflowDetails={isAdvisor} video={shownVideo} scenario={scenarioSnapshotFrom(shownRow?.scenario_snapshot)} />
          </section>
        ) : null}

        {/* Past reports */}
        <details className="mt-6 border-t border-border py-4">
          <summary className="cursor-pointer font-display text-base font-semibold">Past reports <span className="ml-2 text-xs font-normal text-muted-foreground">{reports.length}</span></summary>
          {listQ.isLoading ? (
            <p className="mt-4 flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : listQ.error ? (
            <p className="mt-4 text-sm text-destructive">{(listQ.error as Error).message}</p>
          ) : !listQ.data?.reports.length ? (
            <p className="mt-4 text-sm text-muted-foreground">No reports generated yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 text-left">Period</th>
                    <th className="py-2 text-left">Version</th>
                    <th className="py-2 text-left">Status</th>
                    {isAdvisor && <th className="py-2 text-left">Complete</th>}
                    {isAdvisor && <th className="py-2 text-left">Generated by</th>}
                    <th className="py-2 text-left">Generated</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {listQ.data.reports.map((r: any) => (
                    <tr
                      key={r.id}
                      className={
                        r.id === selectedId
                          ? "border-b border-border/40 bg-primary/10"
                          : "border-b border-border/40"
                      }
                      aria-selected={r.id === selectedId}
                    >
                      <td className="py-2 pr-3">{fmtDate(r.period_end)}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        v{r.version}
                        {isAdvisor && isStalePayload(r) && (
                          <span
                            className="ml-2 rounded-full border border-destructive/40 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive"
                            title={`Calculated with payload v${r.payload_version ?? 0}; current is v${MONTHLY_REPORT_PAYLOAD_VERSION}.`}
                          >
                            calculated with an older version — regenerate
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 capitalize">{r.status}</td>
                      {isAdvisor && <td className="py-2 pr-3">{r.complete ? "Yes" : "No"}</td>}
                      {isAdvisor && <td className="py-2 pr-3">{r.generated_by_name}</td>}
                      <td className="py-2 pr-3">{fmtDate(r.generated_at)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openMut.mutate({ reportId: r.id, source: "opened" })}
                            disabled={openMut.isPending}
                          >
                            <FileText className="mr-1 h-3 w-3" /> Open
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPdfBusyId(r.id);
                              pdfMut.mutate(r);
                            }}
                            disabled={pdfBusyId === r.id}
                          >
                            {pdfBusyId === r.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="mr-1 h-3 w-3" />
                            )}
                            PDF
                          </Button>
                          {isAdvisor && (
                            <>
                              <Button size="sm" variant="outline" disabled={r.status === "draft"} onClick={() => setToSend(r)}>
                                <Mail className="mr-1 h-3 w-3" /> Email
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setToDelete(r)}
                              >
                                <Trash2 className="mr-1 h-3 w-3" /> Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>

        <FinaliseReportDialog
          report={toFinalise}
          clientId={clientId}
          onClose={() => setToFinalise(null)}
          onRegenerate={(r) => {
            setPeriodEnd(r.period_end);
            genMut.mutate(r.period_end);
          }}
        />
        <DeleteReportDialog report={toDelete} clientId={clientId} onClose={() => setToDelete(null)} />
        <SendReportDialog report={toSend} clientId={clientId} onClose={() => setToSend(null)} />
      </PageContainer>
    </div>
  );
}
