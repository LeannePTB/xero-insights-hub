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
import { AuthLayout } from "@/components/auth/AuthLayout";

export const Route = createFileRoute("/signup/$token")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Accept your invitation — Traction Advisory" }, { name: "description", content: "Set up your invited Traction Advisory account." }, { property: "og:title", content: "Accept your invitation — Traction Advisory" }, { property: "og:description", content: "Set up your invited Traction Advisory account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SignupPage,
  errorComponent: ({ error }) => (
    <AuthLayout>
      <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Something went wrong."}</p>
    </AuthLayout>
  ),
  notFoundComponent: () => (
    <AuthLayout>
      <p className="text-sm text-muted-foreground">Invite not found.</p>
    </AuthLayout>
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
    mutationFn: () =>
      accept({ data: { token, password, displayName, businessName: businessName || null } }),
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
      <AuthLayout>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </AuthLayout>
    );
  }

  if (inviteQ.error) {
    return (
      <AuthLayout>
        <div className="max-w-sm w-full rounded-md border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Invite unavailable</p>
            <p className="text-sm text-muted-foreground">{(inviteQ.error as Error).message}</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  const invite = inviteQ.data;
  if (!invite) return <AuthLayout><p>Invite not found.</p></AuthLayout>;
  const isOwner = invite.role === "owner";
  const invitationRole =
    invite.kind === "viewer"
      ? invite.relationship === "business_owner"
        ? "Business Owner"
        : "Viewer"
      : invite.role;

  return (
    <AuthLayout>
          <div>
            <h1 className="font-display text-lg font-semibold">Set up your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You've been invited as <span className="font-medium">{invitationRole}</span>.
            </p>
            {invite.kind === "viewer" && (
              <p className="mt-2 text-xs text-muted-foreground">
                {invite.scope === "all_clients"
                  ? "Scope: All clients, including clients added later."
                  : `Scope: ${invite.clientNames.length} selected client${invite.clientNames.length === 1 ? "" : "s"}.`}
              </p>
            )}
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
                <p className="text-xs text-muted-foreground">
                  Shown across your dashboards. You can change this later.
                </p>
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
    </AuthLayout>
  );
}
