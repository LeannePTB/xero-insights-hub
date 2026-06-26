import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth_/mfa-enroll")({
  ssr: false,
  head: () => ({ meta: [{ title: "Set up MFA — Traction Advisory" }] }),
  component: MfaEnrollPage,
});

type EnrollState = { factorId: string; qr: string; secret: string } | null;

function MfaEnrollPage() {
  const navigate = useNavigate();
  const [enroll, setEnroll] = useState<EnrollState>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          navigate({ to: "/auth", replace: true });
          return;
        }
        const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
        if (listErr) throw listErr;
        if ((factors?.totp ?? []).some((f) => f.status === "verified")) {
          navigate({ to: "/auth/mfa-verify", replace: true });
          return;
        }
        // Clear stale unverified factors (visible + hidden) so enroll() can't
        // collide on friendlyName.
        const all =
          (factors as { all?: Array<{ id: string; status: string; factor_type: string }> }).all ?? [];
        const stale = [
          ...all.filter((f) => f.factor_type === "totp" && f.status !== "verified"),
          ...(factors?.totp ?? []).filter((f) => f.status !== "verified"),
        ];
        const seen = new Set<string>();
        for (const f of stale) {
          if (seen.has(f.id)) continue;
          seen.add(f.id);
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Authenticator ${new Date().toISOString()} ${Date.now()}`,
          issuer: "Traction Advisory",
        });
        if (error) throw error;
        setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setErrorMsg(msg);
        toast.error(msg);
        console.error("[mfa-enroll]", e);
      }
    })();
  }, [navigate]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setVerifying(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) throw verify.error;
      toast.success("Two-factor enabled");
      navigate({ to: "/dashboard", replace: true });
    } catch (e: any) {
      const raw = e?.message ?? "Could not verify code";
      const msg = /invalid/i.test(raw)
        ? "That code didn't match. Check your device's clock is set to automatic time, wait for the next 6-digit code, then try again."
        : raw;
      toast.error(msg);
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-semibold">Set up two-factor</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Required for every account. Use 1Password, Authy, or Google Authenticator.
          </p>

          {errorMsg && (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <p className="font-semibold">Couldn't start MFA enrollment</p>
              <p className="mt-1 break-words">{errorMsg}</p>
            </div>
          )}

          <ol className="mt-5 space-y-3 text-sm">
            <li>
              <span className="font-medium">1.</span> Scan the QR code with your authenticator app
              {enroll ? (
                <div className="mt-2 flex flex-col items-center gap-2 rounded-md border bg-white p-3">
                  <img src={enroll.qr} alt="MFA QR code" className="h-44 w-44" />
                  <code className="break-all text-[11px] text-muted-foreground">{enroll.secret}</code>
                </div>
              ) : (
                <div className="mt-2 flex h-44 items-center justify-center rounded-md border bg-muted/30">
                  {errorMsg ? (
                    <span className="text-xs text-muted-foreground">Enrollment unavailable</span>
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
            </li>

            <li>
              <span className="font-medium">2.</span> Enter the 6-digit code your app shows
              <form onSubmit={handleVerify} className="mt-2 space-y-3">
                <Label htmlFor="otp" className="sr-only">6-digit code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center tracking-[0.4em]"
                />
                <Button type="submit" className="w-full" disabled={!enroll || verifying || code.length !== 6}>
                  {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verify and enable
                </Button>
              </form>
            </li>
          </ol>

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 w-full text-center text-xs text-muted-foreground underline"
          >
            Cancel and sign out
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
