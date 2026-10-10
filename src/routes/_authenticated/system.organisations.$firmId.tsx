import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FirmXeroFilesCard } from "@/components/admin/FirmXeroFilesCard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import {
  getFirmDetailAdmin,
  getFirmAuditAdmin,
  adminSendPasswordReset,
  adminSetUserPassword,
  adminUpdateUserEmail,
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
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Mail,
  ShieldAlert,
  History,
  Users,
  Building2,
  Check,
  X,
  Pencil,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { OrgPurchaseCard } from "@/components/admin/OrgPurchaseCard";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { BillingLifecycleCard } from "@/components/admin/BillingLifecycleCard";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SystemOrganisationTabs, SYSTEM_ORGANISATION_TABS, type SystemOrganisationTab } from "@/components/admin/SystemOrganisationTabs";
import { recordViewAs } from "@/lib/view-as.functions";
import { getOrgPurchase } from "@/lib/card-model.functions";
import { listOrganisationUsage } from "@/lib/admin-plan-usage.functions";
import { organisationOptionDisplay } from "@/lib/organisation-option-display";

export const Route = createFileRoute("/_authenticated/system/organisations/$firmId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: SYSTEM_ORGANISATION_TABS.some(([value]) => value === search.tab)
      ? (search.tab as SystemOrganisationTab)
      : ("overview" as const),
  }),
  head: () => ({
    meta: [
      { title: "Organisation Admin — Traction Advisory" },
      {
        name: "description",
        content: "Manage an organisation's options, billing lifecycle, members and clients.",
      },
      { property: "og:title", content: "Organisation Admin — Traction Advisory" },
      {
        property: "og:description",
        content: "Manage an organisation's options, billing lifecycle, members and clients.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

function SupportPanel({ firmId }: { firmId: string }) {
  const qc = useQueryClient();
  const fetchState = useServerFn(getSupportAccess);
  const setMembership = useServerFn(adminSetSelfFirmMembership);
  const record = useServerFn(recordViewAs);
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["support-access", firmId],
    queryFn: () => fetchState({ data: { firmId } }),
  });
  const mut = useMutation({
    mutationFn: (join: boolean) => setMembership({ data: { firmId, join } }),
    onSuccess: (r: any) => {
      toast.success(
        r.member ? "You now have access to this organisation" : "You left this organisation",
      );
      qc.invalidateQueries({ queryKey: ["support-access", firmId] });
      qc.invalidateQueries({ queryKey: ["admin-firm", firmId] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const s = q.data;
  async function preview() {
    try {
      await record({ data: { firmId, mode: "owner" } });
      navigate({ to: "/firms/$firmId", params: { firmId }, search: { viewAs: "owner" } });
    } catch (error) {
      toast.error((error as Error).message || "Could not start the preview.");
    }
  }

  if (!s) return <p className="text-sm text-muted-foreground">Support status is unavailable.</p>;
  return (
    <section className="space-y-5 rounded-lg border p-6">
      <div><h2 className="text-lg font-semibold">Support access</h2><p className="mt-1 text-sm text-muted-foreground">Membership and approved support access are separate, audited paths.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={s.viewerHasClientData ? "success" : "secondary"}>{s.viewerHasClientData ? "Client data available" : "No client data"}</Badge>
        {s.viewerIsMember ? <Badge variant="outline">You are a member</Badge> : <Badge variant={s.granted ? "info" : "outline"}>{s.granted ? "Support access on" : "Support access off"}</Badge>}
      </div>
      {s.grants.length > 0 && <div className="space-y-2"><h3 className="text-sm font-medium">Support history</h3><ul className="divide-y rounded-md border text-sm">{s.grants.map((grant) => <li key={grant.id} className="flex flex-wrap justify-between gap-2 px-3 py-2"><span>{grant.granteeName ?? "Support staff"}</span><span className="capitalize text-muted-foreground">{grant.status} · expires {fmt(grant.expiresAt)}</span></li>)}</ul></div>}
      <div className="flex flex-wrap gap-2">
        {s.viewerIsPlatformStaff && <Button size="sm" variant={s.viewerIsMember ? "outline" : "default"} disabled={mut.isPending} onClick={() => mut.mutate(!s.viewerIsMember)}>{mut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}{s.viewerIsMember ? "Leave organisation" : "Add me as staff"}</Button>}
        <Button size="sm" variant="outline" onClick={() => void preview()} disabled={!s.viewerHasClientData}><Eye className="h-4 w-4" /> Preview as owner</Button>
      </div>
      {!s.viewerHasClientData && <p className="text-xs text-muted-foreground">Preview becomes available when you are a member or hold approved support access.</p>}
    </section>
  );
}

function FirmDetailPage() {
  const { firmId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getDetail = useServerFn(getFirmDetailAdmin);
  const getAudit = useServerFn(getFirmAuditAdmin);
  const getPurchase = useServerFn(getOrgPurchase);
  const getUsage = useServerFn(listOrganisationUsage);

  const detailQ = useQuery({
    queryKey: ["admin-firm", firmId],
    queryFn: () => getDetail({ data: { firmId } }),
  });
  const auditQ = useQuery({
    queryKey: ["admin-firm-audit", firmId],
    queryFn: () => getAudit({ data: { firmId } }),
    enabled: tab === "audit",
  });
  const purchaseQ = useQuery({ queryKey: ["org-purchase", firmId], queryFn: () => getPurchase({ data: { firmId } }) });
  const usageQ = useQuery({ queryKey: ["admin-org-usage", firmId], queryFn: () => getUsage({ data: { firmIds: [firmId] } }) });

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

  const { firm, members } = detailQ.data!;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <FirmPageHeader title={firm.name} actions={firm.is_always_free ? <Badge variant="secondary">Always free</Badge> : undefined} />
        <Tabs value={tab} onValueChange={(value) => void navigate({ to: "/system/organisations/$firmId", params: { firmId }, search: { tab: value as SystemOrganisationTab }, replace: true })}>
          <SystemOrganisationTabs />
          <TabsContent value="overview" className="space-y-6">
            <BusinessNameSection firmId={firmId} currentName={firm.name} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-firm", firmId] })} />
            <OverviewFacts firm={firm} members={members} usage={usageQ.data?.usage?.[0]} purchase={purchaseQ.data?.purchase} subscription={detailQ.data?.subscription ?? null} />
          </TabsContent>
          <TabsContent value="plan"><OrgPurchaseCard firmId={firmId} /></TabsContent>
          <TabsContent value="billing"><BillingLifecycleCard firmId={firmId} subscription={detailQ.data?.subscription ?? null} isAlwaysFree={firm.is_always_free} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-firm", firmId] })} /></TabsContent>
          <TabsContent value="members"><MembersSection firmId={firmId} members={members} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-firm", firmId] })} /></TabsContent>
          <TabsContent value="xero"><FirmXeroFilesCard firmId={firmId} variant="plain" metadataOnly /></TabsContent>
          <TabsContent value="support"><SupportPanel firmId={firmId} /></TabsContent>
          <TabsContent value="audit"><AuditSection events={auditQ.data?.events ?? []} loading={auditQ.isLoading} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function OverviewFacts({ firm, members, usage, purchase, subscription }: { firm: any; members: any[]; usage: any; purchase: any; subscription: any }) {
  const owner = members.find((member) => member.user_id === firm.owner_user_id || member.role === "owner");
  const options = purchase ? organisationOptionDisplay(purchase).filter((option) => option.on).map((option) => `${option.label}${option.trial ? " (trial)" : ""}`) : [];
  const status = firm.is_always_free ? "Always free" : subscription?.status === "past_due" ? "Past due" : subscription?.status === "canceled" ? "Cancelled" : subscription?.status === "paused" ? "Suspended" : subscription?.status === "trialing" ? "Trial" : "Active";
  const limit = usage?.clientLimit >= 9999 ? "∞" : usage?.clientLimit ?? "—";
  return <section className="rounded-lg border p-6"><h2 className="text-lg font-semibold">Quick facts</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
    <Fact label="Status">{status}</Fact><Fact label="Clients">{usage?.clientsUsed ?? "—"} / {limit}</Fact><Fact label="Created">{new Date(firm.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</Fact>
    <Fact label="Owner"><span>{owner?.display_name || owner?.email || "Not assigned"}</span>{owner?.display_name && owner?.email && <span className="block text-xs text-muted-foreground">{owner.email}</span>}</Fact>
    <Fact label="Billing">{purchase?.billingMode === "external" ? "External" : purchase ? "Bookkeeping" : "—"}</Fact><Fact label="Options">{options.length ? options.join(" · ") : "Standard only"}</Fact>
  </dl></section>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{children}</dd></div>; }

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

function MemberRow({
  member,
  firmId,
  onChanged,
}: {
  member: any;
  firmId: string;
  onChanged: () => void;
}) {
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
        {member.display_name && (
          <div className="text-xs text-muted-foreground">{member.display_name}</div>
        )}
      </td>
      <td className="px-4 py-3 capitalize">{member.role}</td>
      <td className="px-4 py-3 text-muted-foreground">{fmt(member.last_sign_in_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending}
          >
            {resetMut.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Mail className="h-3 w-3 mr-1" />
            )}
            Send reset
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPwOpen(true)}>
            <KeyRound className="h-3 w-3 mr-1" />
            Set password
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
            Change email
          </Button>
        </div>
        <SetPasswordDialog
          open={pwOpen}
          onOpenChange={setPwOpen}
          userId={member.user_id}
          firmId={firmId}
          email={member.email}
        />
        <ChangeEmailDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          userId={member.user_id}
          firmId={firmId}
          currentEmail={member.email}
          onChanged={onChanged}
        />
      </td>
    </tr>
  );
}

function SetPasswordDialog({
  open,
  onOpenChange,
  userId,
  firmId,
  email,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  userId: string;
  firmId: string;
  email: string | null;
}) {
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
            This sets a new password immediately. Share it with the user over a secure channel; they
            should change it on first sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>New password</Label>
          <Input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="At least 8 chars, letter + number"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
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
  open,
  onOpenChange,
  userId,
  firmId,
  currentEmail,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  userId: string;
  firmId: string;
  currentEmail: string | null;
  onChanged: () => void;
}) {
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
            Current: {currentEmail ?? "—"}. New email will be marked confirmed; the user signs in
            with it immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>New email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !email.includes("@")}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Presentation only: consecutive rows with the same action and the same meta are
 * shown as one expandable line. No audit row is altered, hidden or removed — the
 * group always lists every row it covers when opened.
 */
function groupAuditEvents(events: any[]) {
  const groups: { key: string; action: string; rows: any[] }[] = [];
  for (const e of events) {
    const signature = `${e.action}|${JSON.stringify(e.meta ?? null)}`;
    const last = groups[groups.length - 1];
    if (last && last.key === signature) last.rows.push(e);
    else groups.push({ key: signature, action: e.action, rows: [e] });
  }
  return groups;
}

function AuditGroup({ group }: { group: { action: string; rows: any[] } }) {
  const [open, setOpen] = useState(false);
  const rows = group.rows;
  const first = rows[0];

  if (rows.length === 1) {
    return (
      <li className="flex items-start gap-3 border-t pt-2">
        <span className="text-muted-foreground tabular-nums whitespace-nowrap">{fmt(first.at)}</span>
        <span className="font-medium">{first.action}</span>
        <span className="text-muted-foreground truncate">{JSON.stringify(first.meta)}</span>
      </li>
    );
  }

  const last = rows[rows.length - 1];
  const earliest = fmt(last.at);
  const latest = fmt(first.at);

  return (
    <li className="border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 text-left hover:underline"
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="font-medium">
          {group.action} ×{rows.length}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {earliest === latest ? earliest : `${earliest} – ${latest}`}
        </span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1 pl-6 text-xs">
          {rows.map((e) => (
            <li key={e.id} className="flex items-start gap-3">
              <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                {fmt(e.at)}
              </span>
              <span className="text-muted-foreground truncate">{JSON.stringify(e.meta)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function AuditSection({ events, loading }: { events: any[]; loading: boolean }) {
  const groups = groupAuditEvents(events);
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
          {groups.map((g) => (
            <AuditGroup key={`${g.key}-${g.rows[0].id}`} group={g} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BusinessNameSection({
  firmId,
  currentName,
  onChanged,
}: {
  firmId: string;
  currentName: string;
  onChanged: () => void;
}) {
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
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Organisation name
        </Label>
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
            <Button
              size="sm"
              onClick={() => mut.mutate()}
              disabled={mut.isPending || name.trim().length < 2}
            >
              {mut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setName(currentName);
                setEditing(false);
              }}
            >
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
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => invite({ data: { firmId, email, role: "staff" as const } }),
    onSuccess: (res) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setInviteUrl(`${origin}/signup/${res.token}`);
      setEmailStatus((res as any).emailStatus ?? null);
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create invite"),
  });

  function reset() {
    setEmail("");
    setInviteUrl(null);
    setEmailStatus(null);
  }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
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
            <p className="text-xs text-muted-foreground">
              Invitations to an existing organisation are always for staff. To change who owns it,
              use Hand over ownership on the organisation settings page.
            </p>
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
            <Button size="sm" variant="outline" onClick={copy}>
              Copy link
            </Button>
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
