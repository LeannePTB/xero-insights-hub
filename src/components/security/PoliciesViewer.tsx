import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Download, FileDown, ScrollText, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { cn } from "@/lib/utils";

const TABS: Array<{ slug: string; label: string }> = [
  { slug: "README", label: "Overview" },
  { slug: "access-control", label: "Access control" },
  { slug: "data-hosting", label: "Data hosting" },
  { slug: "data-retention", label: "Data retention" },
  { slug: "incident-response", label: "Incident response" },
  { slug: "monitoring", label: "Security monitoring" },
  { slug: "sdlc", label: "SDLC" },
  { slug: "vulnerability-management", label: "Vulnerability management" },
  { slug: "xero-assessment-mapping", label: "Xero assessment mapping" },
];

async function fetchDoc(slug: string): Promise<string> {
  const r = await fetch(`/api/public/docs/security/${slug}.md`);
  if (!r.ok) throw new Error(`Failed to load ${slug}`);
  return r.text();
}

export function PoliciesViewer() {
  const [active, setActive] = useState<string>("README");
  const [zipping, setZipping] = useState(false);

  const docQ = useQuery({
    queryKey: ["security-doc", active],
    queryFn: () => fetchDoc(active),
  });

  async function downloadZip() {
    setZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("security")!;
      await Promise.all(
        TABS.map(async (t) => {
          const md = await fetchDoc(t.slug);
          folder.file(`${t.slug}.md`, md);
        }),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "traction-advisory-security-policies.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>Security policies</CardTitle>
          <CardDescription>
            Written policies supporting Xero Security Standard attestation. Source: <code className="font-mono text-xs">docs/security/</code>.
          </CardDescription>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => window.open("/admin/security/xero-assessment-print", "_blank")}
          >
            <FileDown className="h-4 w-4 mr-2" /> Download Xero PDF
          </Button>
          <Button variant="outline" onClick={downloadZip} disabled={zipping}>
            {zipping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download all (.md)
          </Button>
          <Link to="/settings/activity">
            <Button variant="outline">
              <ScrollText className="h-4 w-4 mr-2" /> Audit log
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-[220px_1fr] gap-6">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {TABS.map((t) => (
              <button
                key={t.slug}
                onClick={() => setActive(t.slug)}
                className={cn(
                  "text-left text-sm px-3 py-2 rounded-md whitespace-nowrap transition-colors",
                  active === t.slug
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <article className="prose prose-sm dark:prose-invert max-w-none min-w-0">
            {docQ.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {docQ.error && <p className="text-destructive text-sm">{(docQ.error as Error).message}</p>}
            {docQ.data && (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{docQ.data}</ReactMarkdown>
            )}
          </article>
        </div>
      </CardContent>
    </Card>
  );
}
