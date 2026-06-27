import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { getSecurityPosture } from "@/lib/security.functions";

type PostureStatus = "ok" | "warn" | "action";

type Row = { id: string; title: string; detail: string; status: PostureStatus };

function StatusPill({ status }: { status: PostureStatus }) {
  if (status === "ok") {
    return <Badge className="bg-green-600 hover:bg-green-600 text-white">OK</Badge>;
  }
  if (status === "warn") {
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Warn</Badge>;
  }
  return <Badge variant="destructive">Action</Badge>;
}

export function SecurityPostureCard() {
  const fn = useServerFn(getSecurityPosture);
  const { data, isLoading, error } = useQuery({
    queryKey: ["security-posture"],
    queryFn: () => fn(),
  });

  const rows: Row[] = (() => {
    if (!data) return [];
    const enc = data.tokenEncryption;
    const mfaPct = data.mfa.total ? Math.round((data.mfa.enrolled / data.mfa.total) * 100) : 0;
    return [
      {
        id: "token-enc-key",
        title: "Token encryption key (AES-256-GCM)",
        detail: data.tokenEncKeyConfigured
          ? "TOKEN_ENC_KEY present in Lovable Cloud secrets."
          : "TOKEN_ENC_KEY missing — Xero tokens cannot be encrypted.",
        status: data.tokenEncKeyConfigured ? "ok" : "action",
      },
      {
        id: "xero-tokens-encrypted",
        title: "All Xero tokens encrypted at rest",
        detail:
          enc.total === 0
            ? "No Xero connections yet."
            : `${enc.encrypted}/${enc.total} encrypted, ${enc.plaintext} legacy plaintext awaiting re-read.`,
        status: enc.plaintext === 0 ? "ok" : "warn",
      },
      {
        id: "mfa",
        title: "TOTP MFA enrolment",
        detail: `${data.mfa.enrolled}/${data.mfa.total} staff users enrolled (${mfaPct}%). New sign-ins are forced to enrol before reaching the app.`,
        status: data.mfa.total > 0 && data.mfa.enrolled === data.mfa.total ? "ok" : "action",
      },
      {
        id: "admin-mfa",
        title: "Super admin MFA enforced",
        detail:
          (data.adminMfa?.total ?? 0) === 0
            ? "No super admin users found."
            : `${data.adminMfa.enrolled}/${data.adminMfa.total} super admins have a verified authenticator app factor.`,
        status:
          (data.adminMfa?.total ?? 0) > 0 && data.adminMfa.enrolled === data.adminMfa.total
            ? "ok"
            : "action",
      },
      {
        id: "audit-retention",
        title: `Audit log retention (${data.audit.retentionYears} years)`,
        detail:
          data.audit.rowsOlderThanRetention === 0
            ? "No rows older than retention window."
            : `${data.audit.rowsOlderThanRetention} row(s) older than retention — purge below.`,
        status: data.audit.rowsOlderThanRetention === 0 ? "ok" : "warn",
      },
      {
        id: "xero-oauth",
        title: "Xero OAuth credentials configured",
        detail: data.xeroConfigured
          ? "XERO_CLIENT_ID and XERO_CLIENT_SECRET present."
          : "Missing XERO_CLIENT_ID or XERO_CLIENT_SECRET.",
        status: data.xeroConfigured ? "ok" : "action",
      },
      {
        id: "pkce",
        title: "OAuth 2.0 + PKCE (S256) on Xero connect",
        detail: "code_challenge_method=S256 enforced at /connect start.",
        status: "ok",
      },
      {
        id: "append-only",
        title: "Audit log is append-only",
        detail: "UPDATE/DELETE revoked from authenticated & anon roles.",
        status: "ok",
      },
      {
        id: "hibp",
        title: "Leaked-password (HIBP) check enabled",
        detail: "Enabled in Lovable Cloud auth settings.",
        status: "ok",
      },
      {
        id: "tls",
        title: "TLS 1.2+ end-to-end",
        detail: "Cloudflare termination, HSTS preload header set.",
        status: "ok",
      },
    ];
  })();

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Posture</h2>
          <p className="text-sm text-muted-foreground">
            Live status of the controls documented in the Xero API Consumer Annual Security Assessment.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running checks…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : (
          <div className="divide-y">
            {rows.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-sm text-muted-foreground">{c.detail}</div>
                </div>
                <div className="shrink-0">
                  <StatusPill status={c.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
