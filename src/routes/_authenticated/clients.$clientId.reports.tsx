import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Mail, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { getClient } from "@/lib/clients.functions";
import { getMyContext } from "@/lib/roles.functions";
import { periodOptions } from "@/components/dashboard/recon-periods";
import {
  generateMonthlyReport,
  getStoredMonthlyReport,
  listMonthlyReports,
} from "@/lib/reports/monthly-report.functions";
import { MonthlyReportPreview } from "@/components/reports/MonthlyReportPreview";
import { NotesCard } from "@/components/dashboard/NotesCard";
import {
  DeleteReportDialog,
  SendReportDialog,
  type ReportRow,
} from "@/components/reports/ReportDeliveryDialogs";
import { finaliseMonthlyReport } from "@/lib/reports/report-delivery.functions";
import { getMonthlyReportPdfUrl } from "@/lib/reports/report-pdf.functions";
import type { MonthlyReportPayload } from "@/lib/reports/monthly-report";
import { MONTHLY_REPORT_PAYLOAD_VERSION } from "@/lib/reports/monthly-report";

export const Route = createFileRoute("/_authenticated/clients/$clientId/reports")({
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
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const fetchClient = useServerFn(getClient);
  const fetchCtx = useServerFn(getMyContext);
  const listFn = useServerFn(listMonthlyReports);
  const generateFn = useServerFn(generateMonthlyReport);
  const openFn = useServerFn(getStoredMonthlyReport);

  const periods = useMemo(() => periodOptions(), []);
  const [periodEnd, setPeriodEnd] = useState(periods[1]?.value ?? periods[0]?.value ?? "");
  const [tenantId, setTenantId] = useState<string>("");
  const [preview, setPreview] = useState<
    { payload: MonthlyReportPayload; status: string; version: number; stored: boolean } | null
  >(null);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient({ data: { clientId } }),
  });
  const listQ = useQuery({
    queryKey: ["monthly-reports", clientId],
    queryFn: () => listFn({ data: { clientId } }),
  });

  const isAdvisor = ctxQ.data?.isAdvisor ?? false;

  const client = clientQ.data?.client as any;
  const orgs: { tenantId: string; tenantName: string }[] = (client?.client_xero_orgs ?? [])
    .map((o: any) => ({
      tenantId: o.xero_connections?.tenant_id as string | undefined,
      tenantName: (o.xero_connections?.tenant_name as string | undefined) ?? "Xero organisation",
    }))
    .filter((o: any) => !!o.tenantId);

  const genMut = useMutation({
    mutationFn: () =>
      generateFn({ data: { clientId, periodEnd, tenantId: tenantId || null } }),
    onSuccess: (res: any) => {
      setPreview({ payload: res.payload, status: res.status, version: res.version, stored: false });
      qc.invalidateQueries({ queryKey: ["monthly-reports", clientId] });
      if (res.payload?.complete) toast.success(`Draft version ${res.version} generated`);
      else toast.warning("Generated, but some sections could not be computed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openMut = useMutation({
    mutationFn: (reportId: string) => openFn({ data: { reportId } }),
    onSuccess: (res: any) => {
      setPreview({
        payload: res.report.payload,
        status: res.report.status,
        version: res.report.version,
        stored: true,
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const finaliseFn = useServerFn(finaliseMonthlyReport);
  const finaliseMut = useMutation({
    mutationFn: (reportId: string) => finaliseFn({ data: { reportId } }),
    onSuccess: () => {
      toast.success("Report finalised. It can now be emailed.");
      qc.invalidateQueries({ queryKey: ["monthly-reports", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

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
  const [toSend, setToSend] = useState<ReportRow | null>(null);



  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/clients/$clientId" params={{ clientId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">
          Monthly management reports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {client?.name ?? "Client"} · a report is a point-in-time snapshot; the dashboard stays live.
        </p>

        {/* Generate */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Generate</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">Period</span>
              <select
                className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
            {orgs.length > 1 && (
              <label className="text-sm">
                <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                  Xero organisation
                </span>
                <select
                  className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                >
                  <option value="">{orgs[0].tenantName} (default)</option>
                  {orgs.map((o) => (
                    <option key={o.tenantId} value={o.tenantId}>{o.tenantName}</option>
                  ))}
                </select>
              </label>
            )}
            <Button onClick={() => genMut.mutate()} disabled={genMut.isPending || !periodEnd}>
              {genMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" /> Generate draft
                </>
              )}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Generating writes a draft. A finalised or sent report is never overwritten — regenerating
            creates a new version. Current calculation: payload v{MONTHLY_REPORT_PAYLOAD_VERSION}. A
            draft PDF is watermarked DRAFT; finalising renders the PDF once and it is never
            regenerated.
          </p>
        </section>

        {/* Notes */}
        <div className="mt-6">
          <NotesCard clientId={clientId} canEdit={isAdvisor} />
        </div>

        {/* Preview */}
        {preview && (
          <section className="mt-8">
            <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
              {preview.stored ? "Stored report (as generated)" : "Preview of the draft just generated"}
            </p>
            <MonthlyReportPreview
              payload={preview.payload}
              status={preview.status}
              version={preview.version}
            />
          </section>
        )}

        {/* Past reports */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Past reports</h2>
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
                    <th className="py-2 text-left">Complete</th>
                    <th className="py-2 text-left">Generated by</th>
                    <th className="py-2 text-left">Generated</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {listQ.data.reports.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-2 pr-3">{fmtDate(r.period_end)}</td>
                      <td className="py-2 pr-3 tabular-nums">v{r.version}</td>
                      <td className="py-2 pr-3 capitalize">{r.status}</td>
                      <td className="py-2 pr-3">{r.complete ? "Yes" : "No"}</td>
                      <td className="py-2 pr-3">{r.generated_by_name}</td>
                      <td className="py-2 pr-3">{fmtDate(r.generated_at)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openMut.mutate(r.id)}
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
                          {r.status === "draft" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => finaliseMut.mutate(r.id)}
                              disabled={finaliseMut.isPending}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Finalise
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setToSend(r)}>
                              <Mail className="mr-1 h-3 w-3" /> Email
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setToDelete(r)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <DeleteReportDialog report={toDelete} clientId={clientId} onClose={() => setToDelete(null)} />
        <SendReportDialog report={toSend} clientId={clientId} onClose={() => setToSend(null)} />
      </main>
    </div>
  );
}
