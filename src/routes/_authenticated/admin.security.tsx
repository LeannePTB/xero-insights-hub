import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildXeroAssessmentPdf } from "@/lib/xero-assessment-pdf";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  getAssessmentContact,
  saveAssessmentContact,
  type XeroAssessmentContact,
} from "@/lib/xero-assessment.functions";
import { purgeOldAuditLog } from "@/lib/security.functions";

// Bundle the markdown at build time via Vite ?raw imports.
import readme from "../../../docs/security/README.md?raw";
import accessControl from "../../../docs/security/access-control.md?raw";
import dataHosting from "../../../docs/security/data-hosting.md?raw";
import dataRetention from "../../../docs/security/data-retention.md?raw";
import incidentResponse from "../../../docs/security/incident-response.md?raw";
import monitoring from "../../../docs/security/monitoring.md?raw";
import sdlc from "../../../docs/security/sdlc.md?raw";
import vulnMgmt from "../../../docs/security/vulnerability-management.md?raw";
import xeroMapping from "../../../docs/security/xero-assessment-mapping.md?raw";
import { SecurityPostureCard } from "@/components/admin/SecurityPostureCard";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({ meta: [{ title: "Security & Compliance · Admin" }] }),
  component: SecurityDocsPage,
});

const baseDocs: { id: string; title: string; body: string }[] = [
  { id: "readme", title: "Overview", body: readme },
  { id: "access-control", title: "Access control", body: accessControl },
  { id: "data-hosting", title: "Data hosting", body: dataHosting },
  { id: "data-retention", title: "Data retention", body: dataRetention },
  { id: "incident-response", title: "Incident response", body: incidentResponse },
  { id: "monitoring", title: "Security monitoring", body: monitoring },
  { id: "sdlc", title: "SDLC", body: sdlc },
  { id: "vulnerability-management", title: "Vulnerability management", body: vulnMgmt },
  { id: "xero-assessment-mapping", title: "Xero assessment mapping", body: xeroMapping },
];

type FieldKey = keyof XeroAssessmentContact;

const FIELDS: { key: FieldKey; label: string; type?: string }[] = [
  { key: "legal_name", label: "Company legal name" },
  { key: "trading_name", label: "Trading name" },
  { key: "abn_acn", label: "ABN / ACN" },
  { key: "address", label: "Registered address" },
  { key: "website", label: "Website" },
  { key: "app_name", label: "App name (as registered with Xero)" },
  { key: "xero_client_id", label: "Xero app ID / client ID" },
  { key: "contact_name", label: "Primary contact name" },
  { key: "contact_role", label: "Primary contact role" },
  { key: "contact_email", label: "Primary contact email", type: "email" },
  { key: "contact_phone", label: "Primary contact phone", type: "tel" },
  { key: "assessment_date", label: "Assessment date", type: "date" },
];

function renderSection1(contact: XeroAssessmentContact): string {
  const row = (label: string, val: string | null | undefined) =>
    `| ${label} | ${val && String(val).trim().length > 0 ? String(val) : "_(not provided)_"} |`;
  return [
    "## Section 1 — Contact details",
    "",
    "| Field | Value |",
    "| --- | --- |",
    row("Company legal name", contact.legal_name),
    row("Trading name", contact.trading_name),
    row("ABN / ACN", contact.abn_acn),
    row("Registered address", contact.address),
    row("Website", contact.website),
    row("App name", contact.app_name),
    row("Xero app ID / client ID", contact.xero_client_id),
    row("Primary contact name", contact.contact_name),
    row("Primary contact role", contact.contact_role),
    row("Primary contact email", contact.contact_email),
    row("Primary contact phone", contact.contact_phone),
    row("Assessment date", contact.assessment_date),
    "",
    "**1.5 How your application uses the Xero API**",
    "",
    contact.api_usage_description && contact.api_usage_description.trim().length > 0
      ? contact.api_usage_description
      : "_(not provided)_",
    "",
  ].join("\n");
}

function SecurityDocsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAssessmentContact);
  const saveFn = useServerFn(saveAssessmentContact);
  const purgeFn = useServerFn(purgeOldAuditLog);

  const { data: contact } = useQuery({
    queryKey: ["xero-assessment-contact"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState<XeroAssessmentContact>({});
  const [editing, setEditing] = useState(false);

  const effective = editing ? form : (contact ?? {});

  const save = useMutation({
    mutationFn: (payload: XeroAssessmentContact) => saveFn({ data: payload }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["xero-assessment-contact"] });
      setEditing(false);
      toast.success("Section 1 saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const purgeM = useMutation({
    mutationFn: () => purgeFn(),
    onSuccess: (r) => toast.success(`Deleted ${r.deleted} audit row(s) older than 2 years.`),
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = () => {
    setForm(contact ?? {});
    setEditing(true);
  };

  const setField = (key: FieldKey, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const section1Md = renderSection1(contact ?? {});
  const docs = baseDocs.map((d) => {
    if (d.id !== "xero-assessment-mapping") return d;
    const marker = "\n## Section 2";
    const idx = d.body.indexOf(marker);
    const body =
      idx === -1
        ? `${d.body}\n\n${section1Md}`
        : `${d.body.slice(0, idx)}\n${section1Md}\n${d.body.slice(idx + 1)}`;
    return { ...d, body };
  });

  const [activeId, setActiveId] = useState(docs[0].id);
  const active = docs.find((d) => d.id === activeId) ?? docs[0];

  const downloadAll = () => {
    const bundle = docs
      .map((d) => `# ${d.title}\n\n${d.body}\n\n---\n`)
      .join("\n");
    const blob = new Blob([bundle], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "security-policies.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadXeroPdf = () => {
    const pdf = buildXeroAssessmentPdf(contact ?? {}, xeroMapping, {
      readme,
      accessControl,
      dataHosting,
      dataRetention,
      incidentResponse,
      monitoring,
      sdlc,
      vulnerabilityManagement: vulnMgmt,
    });
    pdf.save("xero-security-assessment.pdf");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Admin
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold">Security &amp; Compliance</h1>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Security policies</h2>
          <p className="text-sm text-muted-foreground">
            Written policies supporting Xero Security Standard attestation. Source:{" "}
            <code>docs/security/</code>.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={downloadXeroPdf}>
            Download Xero PDF
          </Button>
          <Button size="sm" variant="outline" onClick={downloadAll}>
            Download all (.md)
          </Button>
          <Link to="/settings/activity">
            <Button size="sm" variant="outline">Audit log</Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => purgeM.mutate()}
            disabled={purgeM.isPending}
          >
            {purgeM.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Purge audit log &gt; 2 years
          </Button>
        </div>
      </div>

      <SecurityPostureCard />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Section 1 — Contact details</h2>
              <p className="text-sm text-muted-foreground">
                Captured for the Xero Security Assessment. Renders into the Xero
                assessment mapping doc and the downloaded bundle.
              </p>
            </div>
            {!editing ? (
              <Button size="sm" variant="outline" onClick={startEdit}>
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={save.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => save.mutate(form)}
                  disabled={save.isPending}
                >
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
                <Input
                  id={`f-${f.key}`}
                  type={f.type ?? "text"}
                  value={(effective[f.key] as string | null | undefined) ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  disabled={!editing}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-api_usage_description">
              1.5 — How your application uses the Xero API
            </Label>
            <p className="text-xs text-muted-foreground">
              Describe how you leverage the Xero API, its purpose, the data
              used, and any integrations. Helps the Xero Security Team focus
              their review.
            </p>
            <Textarea
              id="f-api_usage_description"
              rows={6}
              value={
                (effective.api_usage_description as string | null | undefined) ?? ""
              }
              onChange={(e) => setField("api_usage_description", e.target.value)}
              disabled={!editing}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <nav className="space-y-1">
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveId(d.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                d.id === activeId
                  ? "bg-muted font-medium"
                  : "hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              {d.title}
            </button>
          ))}
        </nav>

        <Card>
          <CardContent className="p-6">
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.body}</ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
