import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { FirmClientsSection } from "@/components/admin/FirmClientsSection";
import { FirmXeroFilesCard } from "@/components/admin/FirmXeroFilesCard";
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
  adminRenameFirm,
  adminSetSelfFirmMembership,
} from "@/lib/admin.functions";
import { adminInviteFirmMember } from "@/lib/invites.functions";
import { getSupportAccess } from "@/lib/support-access.functions";

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
import { Loader2, KeyRound, Mail, ShieldAlert, History, CreditCard, Users, Building2, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { SubscriptionEditor } from "@/components/admin/SubscriptionEditor";


export const Route = createFileRoute("/_authenticated/admin/firms/$firmId")({
  head: () => ({ meta: [{ title: "Organisation — Admin" }] }),
  component: FirmDetailPage,
});



function fmt(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "";
  return new Date(s).toISOString().slice(0, 10);
}

function SupportAccessBadge({ firmId }: { firmId: string }) {
  const qc = useQueryClient();
  const fetchState = useServerFn(getSupportAccess);
  const setMembership = useServerFn(adminSetSelfFirmMembership);
  const q = useQuery({
    queryKey: ["support-access", firmId],
    queryFn: () => fetchState({ data: { firmId } }),
  });
  const mut = useMutation({
    mutationFn: (join: boolean) => setMembership({ data: { firmId, join } }),
    onSuccess: (r: any) => {
      toast.success(r.member ? "You now have access to this organisation" : "You left this organisation");
      qc.invalidateQueries({ queryKey: ["support-access", firmId] });
      qc.invalidateQueries({ queryKey: ["admin-firm", firmId] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const s = q.data;
  if (!s) return <Badge variant="secondary" className="ml-auto">no client data</Badge>;
  return (
    <div className="ml-auto flex items-center gap-2">
      <Badge variant={s.viewerHasClientData ? "default" : "secondary"}>
        {s.viewerHasClientData ? "client data available" : "no client data"}
      </Badge>
      {s.viewerIsMember ? (
        <Badge variant="outline">you are a member</Badge>
      ) : (
        <Badge variant={s.granted ? "default" : "outline"} title={
          s.granted
            ? `Support access granted${s.grantedByName ? ` by ${s.grantedByName}` : ""}${s.grantedAt ? ` on ${new Date(s.grantedAt).toLocaleString()}` : ""}`
            : "This organisation hasn't granted support access"
        }>
          {s.granted ? "support access on" : "support access off"}
        </Badge>
      )}
      {s.viewerIsPlatformStaff && (
        <Button
          size="sm"
          variant={s.viewerIsMember ? "outline" : "default"}
          disabled={mut.isPending}
          onClick={() => mut.mutate(!s.viewerIsMember)}
        >
          {mut.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          {s.viewerIsMember ? "Leave organisation" : "Add me as staff"}
        </Button>
      )}
    </div>
  );
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

  const { firm, members, subscription } = detailQ.data!;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{firm.name}</h1>
          {firm.is_always_free && <Badge variant="outline">always free</Badge>}
          <SupportAccessBadge firmId={firmId} />
        </div>
      </header>


      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        <BusinessNameSection
          firmId={firmId}
          currentName={firm.name}
          onChanged={() => qc.invalidateQueries({ queryKey: ["admin-firm", firmId] })}
        />

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

        <FirmXeroFilesCard firmId={firmId} variant="plain" />

        <section className="rounded-lg border p-6 space-y-4">
          <FirmClientsSection
            firmId={firmId}
            firmName={firm.name}
            clientLimit={(detailQ.data as any)?.clientLimit}
            showHealth={false}
            allowClientData={false}
            onChanged={() => qc.invalidateQueries({ queryKey: ["admin-firm", firmId] })}
          />
          <p className="text-xs text-muted-foreground">
            Client names, tiers and linked Xero files only — nothing here opens client data. Client
            dashboards are reachable through “View as”, and only when this organisation has granted
            support access or you are a member of it.
          </p>
        </section>


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
  return (
    <section className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Subscription</h2>
      </div>
      <SubscriptionEditor
        firmId={firmId}
        subscription={subscription}
        isAlwaysFree={isAlwaysFree}
        onChanged={onChanged}
      />
      <p className="text-xs text-muted-foreground">
        The plan controls how many clients and Xero organisations this organisation can have, and
        which dashboards are available. Each client's dashboard tier is set on that client's settings
        page.
      </p>
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
        <div className="ml-auto">
          <InviteMemberDialog firmId={firmId} onCreated={onChanged} />
        </div>
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

function BusinessNameSection({
  firmId, currentName, onChanged,
}: { firmId: string; currentName: string; onChanged: () => void }) {
  const renameFn = useServerFn(adminRenameFirm);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);

  const mut = useMutation({
    mutationFn: () => renameFn({ data: { firmId, name } }),
    onSuccess: () => {
      toast.success("Organisation name updated");
      setEditing(false);
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border p-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Organisation name</Label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {editing ? (
          <>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="max-w-md"
              autoFocus
            />
            <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending || name.trim().length < 2}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setName(currentName); setEditing(false); }}>
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">{currentName}</p>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function InviteMemberDialog({ firmId, onCreated }: { firmId: string; onCreated: () => void }) {
  const invite = useServerFn(adminInviteFirmMember);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "staff">("staff");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => invite({ data: { firmId, email, role } }),
    onSuccess: (res) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setInviteUrl(`${origin}/signup/${res.token}`);
      setEmailStatus((res as any).emailStatus ?? null);
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create invite"),
  });

  function reset() { setEmail(""); setRole("staff"); setInviteUrl(null); setEmailStatus(null); }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Users className="h-4 w-4 mr-2" /> Invite member
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>Share the resulting link with them by email.</DialogDescription>
        </DialogHeader>
        {!inviteUrl ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              {emailStatus === "queued"
                ? "✓ Invite email sent."
                : emailStatus === "suppressed"
                ? "⚠ This address is on the suppression list — share the link manually."
                : "Invite created. The email couldn't be sent — share this link manually."}
            </p>
            <Input readOnly value={inviteUrl} className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={copy}>Copy link</Button>
            <p className="text-xs text-muted-foreground">Backup link — expires in 14 days.</p>
          </div>
        )}
        <DialogFooter>
          {!inviteUrl ? (
            <Button onClick={() => mut.mutate()} disabled={mut.isPending || !email}>
              {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create invite
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
