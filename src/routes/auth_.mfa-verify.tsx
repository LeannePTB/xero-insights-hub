import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth_/mfa-verify")({
  ssr: false,
  head: () => ({ meta: [{ title: "Verify — Traction Advisory" }] }),
  component: MfaVerifyPage,
});

function MfaVerifyPage() {
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = (factors?.totp ?? []).find((f) => f.status === "verified");
      if (!verified) {
        navigate({ to: "/auth/mfa-enroll", replace: true });
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setFactorId(verified.id);
    })();
  }, [navigate]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setVerifying(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) throw verify.error;
      toast.success("Verified");
      navigate({ to: "/dashboard", replace: true });
    } catch (e: any) {
      const raw = e?.message ?? "Invalid code";
      const msg = /invalid/i.test(raw)
        ? "That code didn't match. Check your device's clock is set to automatic time, wait for the next 6-digit code, then try again."
        : raw;
      toast.error(msg);
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  async function handleStartOver() {
    if (!factorId) return;
    setVerifying(true);
    try {
      await supabase.auth.mfa.unenroll({ factorId });
      navigate({ to: "/auth/mfa-enroll", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Could not reset");
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
      <div className="w-full max-w-sm">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-semibold">Two-factor required</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app.
          </p>

          <form onSubmit={handleVerify} className="mt-5 space-y-3">
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
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={!factorId || verifying || code.length !== 6}>
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify
            </Button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-2 text-xs">
            <button
              type="button"
              className="text-muted-foreground underline"
              onClick={handleStartOver}
              disabled={verifying}
            >
              Reset authenticator (set up a new one)
            </button>
            <button type="button" className="text-muted-foreground underline" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
