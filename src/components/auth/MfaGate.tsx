import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

type Status =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "enroll"; factorId: string; uri: string; secret: string }
  | { kind: "verify"; factorId: string };

// Client-side gate that forces every authenticated user to reach AAL2
// (TOTP MFA) before the app shell renders. Mirrors the posture documented in
// the Xero API Consumer security assessment (Section 3).
export function MfaGate() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void checkAal();
  }, []);

  async function checkAal() {
    setErr(null);
    setStatus({ kind: "loading" });
    const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalErr) {
      setErr(aalErr.message);
      setStatus({ kind: "loading" });
      return;
    }
    if (aal?.currentLevel === "aal2") {
      setStatus({ kind: "ok" });
      return;
    }
    // Need MFA: either enrol (no factors) or verify (existing factor).
    const { data: factorsData, error: fErr } = await supabase.auth.mfa.listFactors();
    if (fErr) {
      setErr(fErr.message);
      return;
    }
    const verified = factorsData?.totp?.find((f) => f.status === "verified");
    if (verified) {
      setStatus({ kind: "verify", factorId: verified.id });
      return;
    }
    // No verified factor — start enrolment. Clean up any stale unverified factors first.
    const stale = factorsData?.totp?.filter((f) => f.status !== "verified") ?? [];
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data: enrol, error: eErr } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Traction Advisory ${new Date().toISOString().slice(0, 10)}`,
    });
    if (eErr || !enrol) {
      setErr(eErr?.message ?? "Could not start MFA enrolment.");
      return;
    }
    setStatus({
      kind: "enroll",
      factorId: enrol.id,
      uri: enrol.totp.uri,
      secret: enrol.totp.secret,
    });
  }

  async function submitCode() {
    if (status.kind !== "enroll" && status.kind !== "verify") return;
    setBusy(true);
    setErr(null);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: status.factorId });
      if (chErr || !ch) throw new Error(chErr?.message ?? "Could not challenge factor.");
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: status.factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vErr) {
        const msg = /invalid/i.test(vErr.message)
          ? "That code didn't match. Check that your device's clock is set to automatic time, wait for the next 6-digit code to appear in your authenticator, then try again."
          : vErr.message;
        throw new Error(msg);
      }
      setCode("");
      await checkAal();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function startOver() {
    setBusy(true);
    setErr(null);
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      for (const f of factorsData?.totp ?? []) {
        if (f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      setCode("");
      await checkAal();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (status.kind === "loading") {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (status.kind === "ok") return <Outlet />;

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status.kind === "enroll" ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            {status.kind === "enroll" ? "Set up two-factor authentication" : "Enter your verification code"}
          </CardTitle>
          <CardDescription>
            {status.kind === "enroll"
              ? "Two-factor authentication is required on every account. Scan the QR code or enter the secret in an authenticator app (1Password, Authy, Google Authenticator), then enter the 6-digit code below."
              : "Open your authenticator app and enter the current 6-digit code."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.kind === "enroll" && (
            <>
              <div className="flex justify-center">
                {/* Render QR via Google Chart fallback — works without extra deps. */}
                <img
                  alt="MFA QR code"
                  className="rounded border bg-white p-2"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(status.uri)}`}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Secret (if you can't scan):{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono">{status.secret}</code>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="mfa-code">6-digit code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
            />
          </div>
          {err && (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button onClick={submitCode} disabled={busy || code.length !== 6} className="flex-1">
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Verify
            </Button>
            <Button variant="outline" onClick={signOut} disabled={busy}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
