import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const Route = createFileRoute("/set-password")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Set your password — Traction Advisory" }, { name: "description", content: "Set your Traction Advisory account password." }, { property: "og:title", content: "Set your password — Traction Advisory" }, { property: "og:description", content: "Set your Traction Advisory account password." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
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
    <AuthLayout>
          <h1 className="font-display text-lg font-semibold">Set your password</h1>
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
                Ask Traction Advisory to resend your invite, or request a password reset on the sign-in page.
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
    </AuthLayout>
  );
}
