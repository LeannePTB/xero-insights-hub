import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getInvitePublic, acceptInvite } from "@/lib/invites.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/signup/$token")({
  head: () => ({ meta: [{ title: "Accept invite — Traction Advisory" }] }),
  component: SignupPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6">
      <p className="text-sm text-destructive">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6">
      <p className="text-sm text-muted-foreground">Invite not found.</p>
    </div>
  ),
});

function SignupPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const fetchInvite = useServerFn(getInvitePublic);
  const accept = useServerFn(acceptInvite);

  const inviteQ = useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchInvite({ data: { token } }),
    retry: false,
  });

  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");

  const mut = useMutation({
    mutationFn: () => accept({ data: { token, password, displayName, businessName: businessName || null } }),
    onSuccess: async (res) => {
      // Sign the user in immediately so they land on dashboard.
      const { error } = await supabase.auth.signInWithPassword({ email: res.email, password });
      if (error) {
        toast.success("Account created. Please sign in.");
        navigate({ to: "/auth" });
        return;
      }
      toast.success("Welcome aboard");
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not accept invite"),
  });

  if (inviteQ.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (inviteQ.error) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-sm w-full rounded-md border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Invite unavailable</p>
            <p className="text-sm text-muted-foreground">{(inviteQ.error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  const invite = inviteQ.data!;
  const isOwner = invite.role === "owner";

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between p-12 text-primary-foreground md:flex" style={{ background: "var(--gradient-hero)" }}>
        <BrandMark onDark logoHeightClass="h-9" />
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Welcome to
            <br />
            <span className="font-serif italic text-accent">Traction Advisory</span>
          </h2>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/75">
            Clean Xero dashboards built around the metrics that matter.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/55">© {new Date().getFullYear()} Positive Traction</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="font-display text-2xl font-semibold">Set up your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You've been invited as <span className="font-medium">{invite.role}</span>.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={invite.email} disabled />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>

            {isOwner && (
              <div className="space-y-1.5">
                <Label htmlFor="business">Organisation</Label>
                <Input
                  id="business"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Smith Advisory Group"
                />
                <p className="text-xs text-muted-foreground">Shown across your dashboards. You can change this later.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters, with a number"
              />
            </div>

            <Button
              className="w-full"
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !password || !displayName || (isOwner && !businessName)}
            >
              {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
