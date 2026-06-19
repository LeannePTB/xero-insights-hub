import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import heroImage from "@/assets/hero-construction.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Traction Advisory" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleSignIn() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
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
          : "https://tractionadvisory.app/set-password";
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
        <p className="relative z-20 text-xs text-primary-foreground/70">© {new Date().getFullYear()} Positive Traction</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your dashboards.</p>


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
            <p className="pt-1 text-center text-xs text-muted-foreground">
              Access is invite-only. Contact Positive Traction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
