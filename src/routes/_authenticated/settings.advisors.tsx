import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAdvisors,
  inviteAdvisor,
  revokeAdvisor,
  resendAdvisorInvite,
  resendAllPendingAdvisorInvites,
  listPendingAdvisors,
  generateAdvisorInviteLink,
  createAdvisorWithPassword,
  PRIMARY_ADVISOR_USER_ID,
} from "@/lib/advisors.functions";
import { getMyContext } from "@/lib/roles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, UserPlus, Trash2, ShieldCheck, Send, Link2, KeyRound, Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/advisors")({
  head: () => ({ meta: [{ title: "Advisors — Traction Advisory" }] }),
  component: AdvisorSettings,
});

function AdvisorSettings() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getMyContext);
  const fetchList = useServerFn(listAdvisors);
  const inviteFn = useServerFn(inviteAdvisor);
  const revokeFn = useServerFn(revokeAdvisor);

  const fetchPending = useServerFn(listPendingAdvisors);
  const resendOneFn = useServerFn(resendAdvisorInvite);
  const resendAllFn = useServerFn(resendAllPendingAdvisorInvites);
  const genLinkFn = useServerFn(generateAdvisorInviteLink);
  const createPwFn = useServerFn(createAdvisorWithPassword);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const listQ = useQuery({
    queryKey: ["advisors"],
    queryFn: () => fetchList(),
    enabled: ctxQ.data?.isAdvisor ?? false,
  });
  const pendingQ = useQuery({
    queryKey: ["advisors-pending"],
    queryFn: () => fetchPending(),
    enabled: ctxQ.data?.isAdvisor ?? false,
  });

  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  const inviteMut = useMutation({
    mutationFn: () => inviteFn({ data: { email } }),
    onSuccess: ({ invited }) => {
      toast.success(invited ? "Invite email sent" : "Advisor access granted");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["advisors"] });
      qc.invalidateQueries({ queryKey: ["advisors-pending"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createPwMut = useMutation({
    mutationFn: () => createPwFn({ data: { email, password } }),
    onSuccess: () => {
      toast.success(`Advisor created — ${email}`);
      setLastCreated({ email, password });
      setEmail("");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["advisors"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resendOneMut = useMutation({
    mutationFn: (userId: string) => resendOneFn({ data: { userId } }),
    onSuccess: (r) => toast.success(`Invite re-sent to ${r.email}`),
    onError: (e: any) => toast.error(e.message),
  });

  const copyLinkMut = useMutation({
    mutationFn: (userId: string) => genLinkFn({ data: { userId } }),
    onSuccess: async (r) => {
      try {
        await navigator.clipboard.writeText(r.link);
        toast.success(`Invite link copied for ${r.email}`);
      } catch {
        window.prompt("Copy this invite link:", r.link);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resendAllMut = useMutation({
    mutationFn: () => resendAllFn(),
    onSuccess: (r) => {
      if (r.resent.length === 0) toast("No pending invites to resend");
      else toast.success(`Re-sent ${r.resent.length} invite${r.resent.length === 1 ? "" : "s"}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (userId: string) => revokeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Advisor removed");
      qc.invalidateQueries({ queryKey: ["advisors"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (ctxQ.isLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!ctxQ.data?.isAdvisor) return <p className="p-6 text-sm text-destructive">Advisors only.</p>;

  const advisors = listQ.data?.advisors ?? [];
  const pendingIds = new Set(pendingQ.data?.pendingUserIds ?? []);
  const pendingCount = pendingIds.size;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> All clients</Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-semibold">Advisors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite teammates to manage clients and dashboards. Advisors have full access to every client.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="mb-3 font-display text-lg font-semibold">Invite an advisor</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="advisor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => inviteMut.mutate()} disabled={!email.includes("@") || inviteMut.isPending}>
              {inviteMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Invite
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            If the email isn't registered yet, they'll receive an invite link. Existing users are upgraded to advisor immediately.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Current advisors</h2>
            {pendingCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => resendAllMut.mutate()}
                disabled={resendAllMut.isPending}
              >
                {resendAllMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Resend {pendingCount} pending invite{pendingCount === 1 ? "" : "s"}
              </Button>
            )}
          </div>
          {listQ.isLoading ? (
            <div className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</div>
          ) : advisors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No advisors yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {advisors.map((a) => {
                const isPending = pendingIds.has(a.user_id);
                const isPrimary = a.user_id === PRIMARY_ADVISOR_USER_ID;
                return (
                  <li key={a.id} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {a.display_name ?? a.email ?? a.user_id}
                          {a.is_self && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                          {isPrimary && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Primary</span>}
                          {isPending && <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">Pending invite</span>}
                        </p>
                        {a.email && a.display_name && <p className="truncate text-xs text-muted-foreground">{a.email}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isPending && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyLinkMut.mutate(a.user_id)}
                            disabled={copyLinkMut.isPending}
                            title="Copy invite link"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resendOneMut.mutate(a.user_id)}
                            disabled={resendOneMut.isPending}
                            title="Resend invite email"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Remove advisor access for ${a.email ?? a.display_name ?? a.user_id}?`)) {
                            revokeMut.mutate(a.user_id);
                          }
                        }}
                        disabled={a.is_self || isPrimary || revokeMut.isPending}
                        title={isPrimary ? "The primary advisor can't be removed" : a.is_self ? "You can't remove yourself" : "Remove advisor access"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </main>
    </div>
  );
}
