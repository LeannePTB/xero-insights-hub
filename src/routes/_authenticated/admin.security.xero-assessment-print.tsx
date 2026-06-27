import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSecurityContact } from "@/lib/security.functions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/security/xero-assessment-print")({
  head: () => ({ meta: [{ title: "Xero Security Assessment — Traction Advisory" }] }),
  component: PrintPage,
});

const SLUGS = [
  "README",
  "access-control",
  "data-hosting",
  "data-retention",
  "incident-response",
  "monitoring",
  "sdlc",
  "vulnerability-management",
  "xero-assessment-mapping",
];

function PrintPage() {
  const fetchContact = useServerFn(getSecurityContact);
  const contactQ = useQuery({ queryKey: ["security-contact"], queryFn: () => fetchContact() });
  const [docs, setDocs] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all(
      SLUGS.map((s) =>
        fetch(`/api/public/docs/security/${s}.md`).then((r) => r.text()).then((t) => [s, t] as const),
      ),
    ).then((entries) => setDocs(Object.fromEntries(entries)));
  }, []);

  if (contactQ.isLoading || Object.keys(docs).length < SLUGS.length) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const c = contactQ.data!;

  const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="break-inside-avoid">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );

  return (
    <div className="bg-white text-black">
      <div className="print:hidden p-4 border-b flex justify-end max-w-4xl mx-auto">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print / Save as PDF
        </Button>
      </div>
      <div className="max-w-4xl mx-auto p-8 print:p-0 space-y-8">
        <header>
          <h1 className="text-3xl font-bold">Xero API Consumer — Security Assessment</h1>
          <p className="text-sm text-muted-foreground">{c.company_legal_name ?? c.trading_name ?? ""}</p>
        </header>

        <section className="break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3 border-b pb-1">Section 1 — Contact details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company legal name" value={c.company_legal_name} />
            <Field label="Trading name" value={c.trading_name} />
            <Field label="ABN / ACN" value={c.abn} />
            <Field label="Registered address" value={c.registered_address} />
            <Field label="Website" value={c.website} />
            <Field label="App name" value={c.app_name} />
            <Field label="Xero app ID / client ID" value={c.xero_client_id} />
            <Field label="Primary contact name" value={c.primary_contact_name} />
            <Field label="Primary contact role" value={c.primary_contact_role} />
            <Field label="Primary contact email" value={c.primary_contact_email} />
            <Field label="Primary contact phone" value={c.primary_contact_phone} />
            <Field label="Assessment date" value={c.assessment_date} />
          </div>
        </section>

        <section className="break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3 border-b pb-1">1.5 — How your application uses the Xero API</h2>
          <p className="text-sm whitespace-pre-wrap">{c.xero_api_usage ?? "—"}</p>
        </section>

        {SLUGS.map((s) => (
          <section key={s} className="break-before-page">
            <article className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{docs[s]}</ReactMarkdown>
            </article>
          </section>
        ))}
      </div>
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
