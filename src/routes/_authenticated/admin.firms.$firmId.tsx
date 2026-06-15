import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getFirmDetailAdmin,
  getFirmAuditAdmin,
  adminSendPasswordReset,
  adminSetUserPassword,
  adminUpdateUserEmail,
  adminUpdateSubscription,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, KeyRound, Mail, ShieldAlert, History, CreditCard, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/firms/$firmId")({
  head: () => ({ meta: [{ title: "Firm — Admin" }] }),
  component: FirmDetailPage,
});

const TIERS = ["starter", "growth", "scale", "firm", "legacy"];
const STATUSES = ["trialing", "active", "past_due", "canceled", "paused"];

function fmt(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "";
  return new Date(s).toISOString().slice(0, 10);
}

function FirmDetailPage() {
  const { firmId } = Route.useParams();
  const qc = useQueryClient();
  const getDetail = useServerFn(getFirmDetailAdmin);
  const getAudit = useServerFn(getFirmAuditAdmin);

  const detailQ = useQuery({
    queryKey: ["admin-firm", firmId],
    queryFn: () => getDetail({ data: { firmId } }),
  });
  const auditQ = useQuery({
    queryKey: ["admin-firm-audit", firmId],
    queryFn: () => getAudit({ data: { firmId } }),
  });

  if (detailQ.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (detailQ.error) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
          <p className="text-sm">{(detailQ.error as Error).message}</p>
        </div>
      </div>
    );
  }

  const { firm, members, subscription, billing } = detailQ.data!;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-2" />All firms</Link>
          </Button>
          <h1 className="text-xl font-semibold">{firm.name}</h1>
          {firm.is_always_free && <Badge variant="outline">always free</Badge>}
          <Badge variant="secondary" className="ml-auto">redacted view</Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        <SubscriptionSection
          firmId={firmId}
          subscription={subscription}
          isAlwaysFree={firm.is_always_free}
          onChanged={() => qc.invalidateQueries({ queryKey: ["admin-firm", firmId] })}
        />

        <MembersSection
          firmId={firmId}
          members={members}
          onChanged={() => qc.invalidateQueries({ queryKey: ["admin-firm", firmId] })}
        />

        <BillingSection events={billing} />

        <AuditSection events={auditQ.data?.events ?? []} loading={auditQ.isLoading} />
      </main>
    </div>
  );
}

function SubscriptionSection({
  firmId,
  subscription,
  isAlwaysFree,
  onChanged,
}: {
  firmId: string;
  subscription: any;
  isAlwaysFree: boolean;
  onChanged: () => void;
}) {
  const updateFn = useServerFn(adminUpdateSubscription);
  const [tier, setTier] = useState<string>(subscription?.tier ?? "starter");
  const [status, setStatus] = useState<string>(subscription?.status ?? "trialing");
  const [trialEnds, setTrialEnds] = useState<string>(fmtDate(subscription?.trial_ends_at));
  const [periodEnd, setPeriodEnd] = useState<string>(fmtDate(subscription?.current_period_end));
  const [cancelEnd, setCancelEnd] = useState<boolean>(!!subscription?.cancel_at_period_end);
  const [alwaysFree, setAlwaysFree] = useState<boolean>(!!isAlwaysFree);

  const mut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          firmId,
          tier,
          status,
          trial_ends_at: trialEnds ? new Date(trialEnds).toISOString() : null,
          current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
          cancel_at_period_end: cancelEnd,
          is_always_free: alwaysFree,
        },
      }),
    onSuccess: () => {
      toast.success("Subscription updated");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Subscription</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Tier</Label>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIERS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Trial ends</Label>
          <Input type="date" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Current period end</Label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Cancel at period end</p>
            <p className="text-xs text-muted-foreground">Subscription ends on the date above.</p>
          </div>
          <Switch checked={cancelEnd} onCheckedChange={setCancelEnd} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Always free</p>
            <p className="text-xs text-muted-foreground">Never charge this firm regardless of tier.</p>
          </div>
          <Switch checked={alwaysFree} onCheckedChange={setAlwaysFree} />
        </div>
      </div>

      <div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save subscription
        </Button>
      </div>
    </section>
  );
}

function MembersSection({
  firmId,
  members,
  onChanged,
}: {
  firmId: string;
  members: any[];
  onChanged: () => void;
}) {
  return (
    <section className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Members</h2>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Last sign-in</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <MemberRow key={m.id} member={m} firmId={firmId} onChanged={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MemberRow({ member, firmId, onChanged }: { member: any; firmId: string; onChanged: () => void }) {
  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const resetFn = useServerFn(adminSendPasswordReset);

  const resetMut = useMutation({
    mutationFn: () => resetFn({ data: { userId: member.user_id, firmId } }),
    onSuccess: (r) => toast.success(`Reset email sent to ${r.email}`),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <tr className="border-t">
      <td className="px-4 py-3">
        <div className="font-medium">{member.email ?? "—"}</div>
        {member.display_name && <div className="text-xs text-muted-foreground">{member.display_name}</div>}
      </td>
      <td className="px-4 py-3 capitalize">{member.role}</td>
      <td className="px-4 py-3 text-muted-foreground">{fmt(member.last_sign_in_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => resetMut.mutate()} disabled={resetMut.isPending}>
            {resetMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
            Send reset
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPwOpen(true)}>
            <KeyRound className="h-3 w-3 mr-1" />Set password
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
            Change email
          </Button>
        </div>
        <SetPasswordDialog open={pwOpen} onOpenChange={setPwOpen} userId={member.user_id} firmId={firmId} email={member.email} />
        <ChangeEmailDialog open={emailOpen} onOpenChange={setEmailOpen} userId={member.user_id} firmId={firmId} currentEmail={member.email} onChanged={onChanged} />
      </td>
    </tr>
  );
}

function SetPasswordDialog({
  open, onOpenChange, userId, firmId, email,
}: { open: boolean; onOpenChange: (b: boolean) => void; userId: string; firmId: string; email: string | null }) {
  const setFn = useServerFn(adminSetUserPassword);
  const [pw, setPw] = useState("");
  const mut = useMutation({
    mutationFn: () => setFn({ data: { userId, firmId, newPassword: pw } }),
    onSuccess: () => {
      toast.success("Password updated");
      setPw("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set password for {email ?? "user"}</DialogTitle>
          <DialogDescription>
            This sets a new password immediately. Share it with the user over a secure channel; they should change it on first sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>New password</Label>
          <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 chars, letter + number" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || pw.length < 8}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Set password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeEmailDialog({
  open, onOpenChange, userId, firmId, currentEmail, onChanged,
}: { open: boolean; onOpenChange: (b: boolean) => void; userId: string; firmId: string; currentEmail: string | null; onChanged: () => void }) {
  const updFn = useServerFn(adminUpdateUserEmail);
  const [email, setEmail] = useState(currentEmail ?? "");
  const mut = useMutation({
    mutationFn: () => updFn({ data: { userId, firmId, newEmail: email } }),
    onSuccess: () => {
      toast.success("Email updated");
      onChanged();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change email</DialogTitle>
          <DialogDescription>
            Current: {currentEmail ?? "—"}. New email will be marked confirmed; the user signs in with it immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>New email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !email.includes("@")}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillingSection({ events }: { events: any[] }) {
  return (
    <section className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Billing history</h2>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No billing events recorded yet.</p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const amt = e.payload?.amount ?? e.payload?.amount_total ?? e.payload?.amount_paid;
                const currency = (e.payload?.currency ?? "").toUpperCase();
                return (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-2 text-muted-foreground">{fmt(e.occurred_at)}</td>
                    <td className="px-4 py-2">{e.type}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {amt != null ? `${(amt / 100).toFixed(2)} ${currency}` : "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{e.stripe_event_id ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AuditSection({ events, loading }: { events: any[]; loading: boolean }) {
  return (
    <section className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Audit log</h2>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 border-t pt-2">
              <span className="text-muted-foreground tabular-nums whitespace-nowrap">{fmt(e.at)}</span>
              <span className="font-medium">{e.action}</span>
              <span className="text-muted-foreground truncate">{JSON.stringify(e.meta)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
