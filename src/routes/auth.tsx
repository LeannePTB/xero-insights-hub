import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logFailedSignIn } from "@/lib/audit.functions";
import { Loader2, LogOut } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { ConnectWithXeroButton } from "@/components/xero/ConnectWithXeroButton";
import { startXeroSignIn } from "@/lib/xero/signin.functions";
import heroImage from "@/assets/hero-construction.jpg";
import { siteUrl } from "@/lib/site-origin";
import { useSignOut } from "@/lib/use-sign-out";
import {
  clearIdleDeadline,
  signOutMessage,
  takeSignOutReason,
  type SignOutReason,
} from "@/lib/session-cutoff";
import { sessionIsActive } from "@/lib/session-activity.functions";


export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Traction Advisory" }] }),
  component: AuthPage,
});

async function routeAfterAuth(navigate: (opts: { to: string; replace?: boolean }) => void | Promise<void>) {
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const hasVerified = (factorsData?.totp ?? []).some((f) => f.status === "verified");
  if (!hasVerified) {
    await navigate({ to: "/auth/mfa-enroll", replace: true });
    return;
  }
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel !== "aal2") {
    await navigate({ to: "/auth/mfa-verify", replace: true });
    return;
  }
  await navigate({ to: "/dashboard", replace: true });
}

function AuthPage() {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [xeroLoading, setXeroLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [endedReason, setEndedReason] = useState<SignOutReason | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("xero_error");
    if (err) {
      toast.error(err);
      params.delete("xero_error");
      const q = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
    if (params.get("xero") === "signedin") {
      toast.success("Signed in with Xero");
    }
    // The session ended: say so plainly. This is NOT a second-factor prompt, so
    // nobody is sent to their authenticator app when they simply need to sign in
    // again, and it never blames access.
    const reason = takeSignOutReason();
    if (reason) {
      setEndedReason(reason);
      toast.info(signOutMessage(reason));
    }
  }, []);


  useEffect(() => {
    (async () => {
      // No daily cut-off (owner decision, 15 Sep 2026): an existing session is
      // offered back — but NEVER a dead end. If the server no longer accepts
      // this session, sign it out here and show the sign-in form with the plain
      // reason, rather than a "Continue" button that leads to a page whose every
      // query is refused. The SERVER answers; this page never decides.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        let stillActive = true;
        try {
          const res = await sessionIsActive();
          stillActive = res.active !== false;
        } catch (err) {
          // A refusal answered as SESSION_IDLE means ended; anything else
          // (offline, transient) leaves the session alone — this page must not
          // sign people out because a request failed.
          stillActive = !/SESSION_IDLE/i.test(String((err as { message?: string })?.message ?? err));
        }
        if (!stillActive) {
          clearIdleDeadline();
          await supabase.auth.signOut();
          setEndedReason("ended");
          setHasSession(false);
          setSignedInEmail(null);
          setCheckingSession(false);
          return;
        }
      }
      setHasSession(!!data.session);
      setSignedInEmail(data.session?.user?.email ?? null);
      setCheckingSession(false);
    })();
  }, [navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setHasSession(false);
        setSignedInEmail(null);
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setHasSession(!!session);
        setSignedInEmail(session?.user?.email ?? null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignIn() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        try {
          await logFailedSignIn({ data: { email, reason: error.message } });
        } catch {
          /* audit is best-effort */
        }
        throw error;
      }
      clearIdleDeadline();
      setEndedReason(null);
      toast.success("Welcome back");
      await routeAfterAuth(navigate);
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.includes("@")) {
      toast.error("Enter your email above, then click Forgot password.");
      return;
    }
    setResetLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/set-password`
          : siteUrl("/set-password");
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast.success("Password reset email sent. Check your inbox.");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't send reset email.");
    } finally {
      setResetLoading(false);
    }
  }


  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative isolate hidden flex-col justify-between overflow-hidden p-12 text-primary-foreground md:flex">
        <img
          src={heroImage}
          alt="Builders framing a new home on an Australian construction site at golden hour"
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 z-10 opacity-70 mix-blend-multiply"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        <div className="relative z-20">
          <BrandMark onDark logoHeightClass="h-9" />
        </div>

        <div className="relative z-20">
          <h2 className="text-3xl font-bold leading-tight">
            Built for decisions.
            <br />
            <span className="font-serif italic text-accent">Backed by data.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/85">
            Clean Xero dashboards you will actually open — built around the metrics that matter.
          </p>
        </div>
        <p className="relative z-20 text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} Traction Advisory ·{" "}
          <Link to="/security" className="underline underline-offset-2 hover:text-primary-foreground">
            Report a security issue
          </Link>
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {checkingSession ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : hasSession ? (
            <div className="space-y-4 text-center">
              <h1 className="font-display text-2xl font-semibold">You are signed in</h1>
              {signedInEmail ? (
                <p className="text-sm text-muted-foreground">{signedInEmail}</p>
              ) : null}
              <Button className="w-full" onClick={() => routeAfterAuth(navigate)}>
                Continue to dashboards
              </Button>
              <Button variant="outline" className="w-full" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold">Welcome</h1>
              {endedReason ? (
                <p className="mt-1 text-sm text-muted-foreground" role="status">
                  {endedReason === "idle"
                    ? `${signOutMessage("idle")}. Please sign in again.`
                    : signOutMessage("ended")}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Sign in to your dashboards.</p>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSignIn} disabled={loading || !email || !password}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign in
                </Button>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="w-full pt-1 text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                >
                  {resetLoading ? "Sending…" : "Forgot password?"}
                </button>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <ConnectWithXeroButton
                  variant="signin"
                  className="w-full"
                  disabled={xeroLoading}
                  onClick={async () => {
                    setXeroLoading(true);
                    try {
                      const { authorizeUrl } = await startXeroSignIn({
                        data: { origin: window.location.origin },
                      });
                      window.location.href = authorizeUrl;
                    } catch (e: any) {
                      toast.error(e?.message ?? "Could not start Sign in with Xero.");
                      setXeroLoading(false);
                    }
                  }}
                />
                <p className="pt-1 text-center text-xs text-muted-foreground">
                  Access is invite-only. Contact Traction Advisory.
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  <Link to="/security" className="underline-offset-2 hover:text-foreground hover:underline">
                    Report a security issue
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
