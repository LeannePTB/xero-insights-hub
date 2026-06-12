import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/set-password")({
  head: () => ({ meta: [{ title: "Set your password — Traction Advisory" }] }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase auto-detects the access_token from the URL hash on load.
    // Wait briefly for that, then check session.
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(!!data.session);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!cancelled) setHasSession(!!session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit() {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password set. Welcome!");
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't set your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between p-12 text-primary-foreground md:flex" style={{ background: "var(--gradient-hero)" }}>
        <BrandMark onDark logoHeightClass="h-9" />
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Welcome aboard.
            <br />
            <span className="font-serif italic text-accent">Set your password.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/75">
            Choose a password so you can sign back in any time.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/55">© {new Date().getFullYear()} Positive Traction</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold">Set your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a password to finish setting up your account.
          </p>

          {hasSession === null ? (
            <div className="mt-6 flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying your link…
            </div>
          ) : !hasSession ? (
            <div className="mt-6 space-y-3 text-sm">
              <p className="text-destructive">This link is invalid or has expired.</p>
              <p className="text-muted-foreground">
                Ask your advisor to resend your invite, or request a password reset on the sign-in page.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/auth" })}>
                Go to sign in
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={loading || !password || !confirm}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save password & continue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
