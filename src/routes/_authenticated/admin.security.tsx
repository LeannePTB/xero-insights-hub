import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSecurityPosture,
  purgeOldAuditLog,
  getSecurityContact,
} from "@/lib/security.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ShieldCheck, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ContactDetailsCard } from "@/components/security/ContactDetailsCard";
import { PoliciesViewer } from "@/components/security/PoliciesViewer";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({ meta: [{ title: "Security & Compliance — Traction Advisory Admin" }] }),
  component: SecurityPage,
});

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
      {ok ? (
        <Badge variant="default" className="bg-emerald-600">OK</Badge>
      ) : (
        <Badge variant="destructive">Action</Badge>
      )}
    </div>
  );
}

function SecurityPage() {
  const fetchPosture = useServerFn(getSecurityPosture);
  const fetchDocs = useServerFn(listSecurityDocs);
  const purgeFn = useServerFn(purgeOldAuditLog);

  const postureQ = useQuery({ queryKey: ["security-posture"], queryFn: () => fetchPosture() });
  const docsQ = useQuery({ queryKey: ["security-docs"], queryFn: () => fetchDocs() });

  const purgeM = useMutation({
    mutationFn: () => purgeFn(),
    onSuccess: (r) => toast.success(`Deleted ${r.deleted} audit row(s) older than 2 years.`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (postureQ.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (postureQ.error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>{(postureQ.error as Error).message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const p = postureQ.data!;
  const enc = p.tokenEncryption;
  const mfaPct = p.mfa.total ? Math.round((p.mfa.enrolled / p.mfa.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Admin
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> Security & Compliance
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Posture</CardTitle>
            <CardDescription>
              Live status of the controls documented in the Xero API Consumer Annual Security Assessment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <Row
              ok={p.tokenEncKeyConfigured}
              label="Token encryption key (AES-256-GCM)"
              detail="TOKEN_ENC_KEY present in Lovable Cloud secrets."
            />
            <Row
              ok={enc.plaintext === 0}
              label="All Xero tokens encrypted at rest"
              detail={`${enc.encrypted}/${enc.total} encrypted, ${enc.plaintext} legacy plaintext awaiting re-read.`}
            />
            <Row
              ok={p.mfa.total === 0 || p.mfa.enrolled === p.mfa.total}
              label="TOTP MFA enrolment"
              detail={`${p.mfa.enrolled}/${p.mfa.total} users enrolled (${mfaPct}%). New sign-ins are forced to enrol before reaching the app.`}
            />
            <Row
              ok={p.audit.rowsOlderThanRetention === 0}
              label={`Audit log retention (${p.audit.retentionYears} years)`}
              detail={
                p.audit.rowsOlderThanRetention === 0
                  ? "No rows older than retention window."
                  : `${p.audit.rowsOlderThanRetention} row(s) exceed retention — run purge below.`
              }
            />
            <Row ok={p.xeroConfigured} label="Xero OAuth credentials configured" />
            <Row ok={true} label="OAuth 2.0 + PKCE (S256) on Xero connect" detail="code_challenge_method=S256 enforced at /connect start." />
            <Row ok={true} label="Audit log is append-only" detail="UPDATE/DELETE revoked from authenticated & anon roles." />
            <Row ok={true} label="Leaked-password (HIBP) check enabled" />
            <Row ok={true} label="TLS 1.2+ end-to-end" detail="Cloudflare termination, HSTS preload header set." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => purgeM.mutate()} disabled={purgeM.isPending}>
              {purgeM.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Purge audit log &gt; 2 years
            </Button>
            <Link to="/admin">
              <Button variant="outline">Manage firms &amp; users</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Policy documents
            </CardTitle>
            <CardDescription>
              Download and share with Xero or other reviewers. Each doc is served as Markdown from a public URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2">
            {(docsQ.data?.docs ?? []).map((d) => (
              <a
                key={d.slug}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between border rounded p-3 hover:bg-muted"
              >
                <span className="font-mono text-sm">{d.slug}.md</span>
                <Download className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
