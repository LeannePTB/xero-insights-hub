import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Loader2, Mail, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listOrganisationMembers } from "@/lib/ownership.functions";
import {
  adminInviteFirmMember,
  listFirmMemberInvites,
  revokeFirmMemberInvite,
} from "@/lib/invites.functions";
import {
  inviteClientViewer,
  listClientAccess,
  listClients,
  revokeClientAccess,
} from "@/lib/clients.functions";
import { getMyContext } from "@/lib/roles.functions";
import { ALL_TIERS, tierLabel } from "@/lib/tiers";
import type { DashboardTier } from "@/lib/tiers";

function Panel({
  title,
  blurb,
  icon,
  children,
}: {
  title: string;
  blurb: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

/**
 * One place for both kinds of person in an organisation. It calls exactly the
 * same server functions as the existing screens — no second implementation of
 * who may invite (super admin only) or of what anyone may see.
 */
export function PeopleSection({ firmId }: { firmId: string }) {
  const qc = useQueryClient();

  const fetchCtx = useServerFn(getMyContext);
  const fetchMembers = useServerFn(listOrganisationMembers);
  const fetchInvites = useServerFn(listFirmMemberInvites);
  const fetchClients = useServerFn(listClients);
  const inviteMember = useServerFn(adminInviteFirmMember);
  const cancelInvite = useServerFn(revokeFirmMemberInvite);
  const inviteViewer = useServerFn(inviteClientViewer);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const canInvite = ctxQ.data?.isSuperAdmin ?? false;

  const membersQ = useQuery({
    queryKey: ["organisation-members", firmId],
    queryFn: () => fetchMembers({ data: { firmId } }),
  });
  const invitesQ = useQuery({
    queryKey: ["firm-member-invites", firmId],
    queryFn: () => fetchInvites({ data: { firmId } }),
    enabled: canInvite,
  });
  const clientsQ = useQuery({
    queryKey: ["clients", firmId],
    queryFn: () => fetchClients({ data: { firmId } }),
  });

  const [memberEmail, setMemberEmail] = useState("");
  const [memberLink, setMemberLink] = useState<string | null>(null);

  const inviteMemberMut = useMutation({
    mutationFn: () => inviteMember({ data: { firmId, email: memberEmail, role: "staff" } }),
    onSuccess: (res: any) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setMemberLink(`${origin}/signup/${res.token}`);
      setMemberEmail("");
      toast.success("Invitation created.");
      qc.invalidateQueries({ queryKey: ["firm-member-invites", firmId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create the invitation."),
  });

  const cancelInviteMut = useMutation({
    mutationFn: (id: string) => cancelInvite({ data: { id } }),
    onSuccess: () => {
      toast.success("Invitation cancelled.");
      qc.invalidateQueries({ queryKey: ["firm-member-invites", firmId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not cancel the invitation."),
  });

  const [viewerClientId, setViewerClientId] = useState<string>("");
  const [viewerEmail, setViewerEmail] = useState("");
  const [viewerTier, setViewerTier] = useState<DashboardTier>("basic");

  const inviteViewerMut = useMutation({
    mutationFn: () =>
      inviteViewer({ data: { clientId: viewerClientId, email: viewerEmail, tier: viewerTier } }),
    onSuccess: () => {
      toast.success("Client viewer added.");
      setViewerEmail("");
      qc.invalidateQueries({ queryKey: ["client-access"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not give that person access."),
  });

  const clients = (clientsQ.data?.clients ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="space-y-6">
      <Panel
        title="Team member"
        blurb="Someone from the advisory or bookkeeping team. A team member sees every client in this organisation, and their Xero data. They can be the owner or staff."
        icon={<Users className="h-5 w-5" />}
      >
        {canInvite ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1 space-y-1.5">
              <Label htmlFor="member-email">Their email address</Label>
              <Input
                id="member-email"
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <p className="h-9 rounded-md border border-border px-3 text-sm leading-9 text-muted-foreground">
                Staff
              </p>
            </div>
            <Button
              onClick={() => inviteMemberMut.mutate()}
              disabled={inviteMemberMut.isPending || !memberEmail}
            >
              {inviteMemberMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Invite team member
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Ownership of an existing organisation is handed over on the settings page, never by
              invitation.
            </p>
            {memberLink && (
              <div className="w-full space-y-1.5">
                <Input readOnly value={memberLink} className="font-mono text-xs" />
                <p className="text-xs text-muted-foreground">
                  Backup link if the email doesn't arrive — expires in 14 days.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only Traction Advisory can add team members. Ask us and we'll send the invitation.
          </p>
        )}

        <div>
          <h3 className="text-sm font-medium">People in this organisation</h3>
          {membersQ.isLoading ? (
            <Loader2 className="mt-3 h-4 w-4 animate-spin text-muted-foreground" />
          ) : (membersQ.data?.members.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nobody yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {(membersQ.data?.members ?? []).map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.displayName ?? m.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{m.role === "owner" ? "Owner" : "Staff"}</Badge>
                    {m.status !== "active" && <Badge variant="secondary">{m.status}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canInvite && (invitesQ.data?.invites.length ?? 0) > 0 && (
          <div>
            <h3 className="text-sm font-medium">Invitations waiting to be accepted</h3>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {(invitesQ.data?.invites ?? []).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{i.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.role === "owner" ? "Owner" : "Staff"} · expires{" "}
                      {new Date(i.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelInviteMut.mutate(i.id)}
                    disabled={cancelInviteMut.isPending}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Cancel
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel
        title="Client viewer"
        blurb="The business owner or one of their staff. A client viewer sees one client's dashboard only, at the level you choose — never another client, and never this organisation's other data."
        icon={<Building2 className="h-5 w-5" />}
      >
        {canInvite ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] space-y-1.5">
              <Label>Which client</Label>
              <Select value={viewerClientId} onValueChange={setViewerClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[14rem] flex-1 space-y-1.5">
              <Label htmlFor="viewer-email">Their email address</Label>
              <Input
                id="viewer-email"
                type="email"
                value={viewerEmail}
                onChange={(e) => setViewerEmail(e.target.value)}
                placeholder="owner@business.com.au"
              />
            </div>
            <div className="min-w-[11rem] space-y-1.5">
              <Label>Dashboard level</Label>
              <Select value={viewerTier} onValueChange={(v) => setViewerTier(v as DashboardTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_TIERS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {tierLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => inviteViewerMut.mutate()}
              disabled={inviteViewerMut.isPending || !viewerClientId || !viewerEmail}
            >
              {inviteViewerMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Give client access
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only Traction Advisory can give a client viewer access. You can still change or remove
            access from each client's own settings page.
          </p>
        )}

        <div className="space-y-3">
          {clients.map((c) => (
            <ClientViewerList key={c.id} clientId={c.id} clientName={c.name} />
          ))}
          {clients.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This organisation has no clients yet, so there is nobody to give access to.
            </p>
          )}
        </div>
      </Panel>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Email addresses shown here are the verified sign-in addresses, not names people chose
        themselves.
      </p>
    </div>
  );
}

function ClientViewerList({ clientId, clientName }: { clientId: string; clientName: string }) {
  const qc = useQueryClient();
  const fetchAccess = useServerFn(listClientAccess);
  const revoke = useServerFn(revokeClientAccess);

  const q = useQuery({
    queryKey: ["client-access", clientId],
    queryFn: () => fetchAccess({ data: { clientId } }),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Access removed.");
      qc.invalidateQueries({ queryKey: ["client-access", clientId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove access."),
  });

  const rows = q.data?.access ?? [];
  if (rows.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium">{clientName}</h3>
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
        {rows.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.display_name ?? a.email}</p>
              <p className="truncate text-xs text-muted-foreground">{a.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline">{tierLabel(a.tier)}</Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => revokeMut.mutate(a.id)}
                disabled={revokeMut.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
