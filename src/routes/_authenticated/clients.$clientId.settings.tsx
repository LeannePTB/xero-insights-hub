import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getClient,
  renameClient,
  attachXeroOrg,
  detachXeroOrg,
  deleteClient,
  listClientAccess,
  inviteClientViewer,
  updateClientAccessTier,
  revokeClientAccess,
} from "@/lib/clients.functions";
import { listTierConfig, saveTierWidgets, listTierSettings } from "@/lib/tier-config.functions";
import { listXeroConnections, startXeroConnect } from "@/lib/xero/connections.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Loader2, Plug, UserPlus, Link2 } from "lucide-react";
import { ALL_TIERS, TIER_LABEL, type DashboardTier, type WidgetKey } from "@/lib/tiers";
import { TierEditor } from "@/routes/_authenticated/settings.tiers";

export const Route = createFileRoute("/_authenticated/clients/$clientId/settings")({
  head: () => ({ meta: [{ title: "Client settings — Traction Advisory" }] }),
  component: ClientSettings,
});

function ClientSettings() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchClient = useServerFn(getClient);
  const fetchConnections = useServerFn(listXeroConnections);
  const fetchAccess = useServerFn(listClientAccess);
  const startConnect = useServerFn(startXeroConnect);

  const rename = useServerFn(renameClient);
  const attach = useServerFn(attachXeroOrg);
  const detach = useServerFn(detachXeroOrg);
  const del = useServerFn(deleteClient);
  const invite = useServerFn(inviteClientViewer);
  const updateTier = useServerFn(updateClientAccessTier);
  const revoke = useServerFn(revokeClientAccess);
  const fetchTierCfg = useServerFn(listTierConfig);
  const saveTier = useServerFn(saveTierWidgets);
  const fetchTierSettings = useServerFn(listTierSettings);

  const clientQ = useQuery({ queryKey: ["client", clientId], queryFn: () => fetchClient({ data: { clientId } }) });
  const connQ = useQuery({ queryKey: ["xero-connections"], queryFn: () => fetchConnections() });
  const accessQ = useQuery({ queryKey: ["client-access", clientId], queryFn: () => fetchAccess({ data: { clientId } }) });
  const tierCfgQ = useQuery({
    queryKey: ["tier-config", clientId],
    queryFn: () => fetchTierCfg({ data: { clientId } }),
  });
  const tierSettingsQ = useQuery({ queryKey: ["tier-settings"], queryFn: () => fetchTierSettings() });
  const enabledTiers = ALL_TIERS.filter((t) => tierSettingsQ.data?.enabled?.[t] ?? true);

  const tierSaveMut = useMutation({
    mutationFn: (v: { tier: DashboardTier; widgets: WidgetKey[] | null }) =>
      saveTier({ data: { clientId, tier: v.tier, widgets: v.widgets } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["tier-config", clientId] });
      qc.invalidateQueries({ queryKey: ["effective-widgets", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTier, setInviteTier] = useState<DashboardTier>("basic");

  useEffect(() => {
    if (clientQ.data?.client?.name && name === "") setName(clientQ.data.client.name as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientQ.data?.client?.name]);

  const renameMut = useMutation({
    mutationFn: () => rename({ data: { clientId, name } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["client", clientId] }); qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const attachMut = useMutation({
    mutationFn: (xeroConnectionId: string) => attach({ data: { clientId, xeroConnectionId } }),
    onSuccess: () => { toast.success("Linked"); qc.invalidateQueries({ queryKey: ["client", clientId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const detachMut = useMutation({
    mutationFn: (id: string) => detach({ data: { id } }),
    onSuccess: () => { toast.success("Unlinked"); qc.invalidateQueries({ queryKey: ["client", clientId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => del({ data: { clientId } }),
    onSuccess: () => { toast.success("Client deleted"); navigate({ to: "/dashboard", replace: true }); },
    onError: (e: any) => toast.error(e.message),
  });

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { clientId, email: inviteEmail, tier: inviteTier } }),
    onSuccess: ({ invited }) => {
      toast.success(invited ? "Invite email sent" : "Access granted");
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["client-access", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const tierMut = useMutation({
    mutationFn: ({ id, tier }: { id: string; tier: DashboardTier }) => updateTier({ data: { id, tier } }),
    onSuccess: () => { toast.success("Tier updated"); qc.invalidateQueries({ queryKey: ["client-access", clientId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("Access removed"); qc.invalidateQueries({ queryKey: ["client-access", clientId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleConnect() {
    const authWindow = window.open("about:blank", "_blank");
    try {
      const { authorizeUrl } = await startConnect({ data: { origin: window.location.origin } });
      if (authWindow) { authWindow.opener = null; authWindow.location.href = authorizeUrl; }
      else window.location.href = authorizeUrl;
    } catch (e: any) { authWindow?.close(); toast.error(e.message); }
  }

  if (clientQ.isLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;
  }
  const client = clientQ.data?.client;
  if (!client) return <p className="p-6 text-sm text-destructive">Client not found.</p>;

  const linkedOrgs: any[] = client.client_xero_orgs ?? [];
  const linkedIds = new Set(linkedOrgs.map((o) => o.xero_connection_id));
  const availableConns = (connQ.data?.connections ?? []).filter((c: any) => !linkedIds.has(c.id));

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/clients/$clientId" params={{ clientId }}><ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard</Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-semibold">{client.name} · Settings</h1>
        </div>

        {/* Name */}
        <Section title="Client name">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={() => renameMut.mutate()} disabled={!name.trim() || name === client.name || renameMut.isPending}>
              {renameMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </div>
        </Section>

        {/* Xero orgs */}
        <Section title="Xero organisations" action={
          <Button variant="outline" size="sm" onClick={handleConnect}><Plug className="mr-1.5 h-3.5 w-3.5" /> Connect new</Button>
        }>
          {linkedOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Xero orgs linked yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {linkedOrgs.map((o) => (
                <li key={o.id} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                  <span className="text-sm font-medium">{o.xero_connections?.tenant_name ?? "Unknown"}</span>
                  <Button variant="ghost" size="sm" onClick={() => detachMut.mutate(o.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {availableConns.length > 0 && (
            <div className="mt-4 rounded-md border border-dashed border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link existing</p>
              <ul className="space-y-1">
                {availableConns.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span>{c.tenant_name}</span>
                    <Button variant="ghost" size="sm" onClick={() => attachMut.mutate(c.id)}>
                      <Link2 className="mr-1 h-3.5 w-3.5" /> Link
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Viewer access */}
        <Section title="Viewer access">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" placeholder="viewer@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" />
            <Select value={inviteTier} onValueChange={(v) => setInviteTier(v as DashboardTier)}>
              <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {enabledTiers.map((t) => (<SelectItem key={t} value={t}>{TIER_LABEL[t]}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={() => inviteMut.mutate()} disabled={!inviteEmail.includes("@") || inviteMut.isPending}>
              {inviteMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Invite
            </Button>
          </div>

          <div className="mt-4">
            {accessQ.isLoading ? (
              <div className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</div>
            ) : (accessQ.data?.access ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No viewers yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {(accessQ.data?.access ?? []).map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.display_name ?? a.email ?? a.user_id}</p>
                      {a.email && a.display_name && <p className="truncate text-xs text-muted-foreground">{a.email}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={a.tier} onValueChange={(v) => tierMut.mutate({ id: a.id, tier: v as DashboardTier })}>
                        <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {enabledTiers.map((t) => (<SelectItem key={t} value={t}>{TIER_LABEL[t]}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => revokeMut.mutate(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        {/* Danger */}
        {/* Per-client tier overrides */}
        <Section title="Dashboard widgets per tier" action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/settings/tiers">Edit defaults</Link>
          </Button>
        }>
          <p className="mb-4 text-xs text-muted-foreground">
            Override which widgets appear for this client. Leave a tier on its global default by clicking "Use default".
          </p>
          {tierCfgQ.isLoading ? (
            <div className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="space-y-4">
              {ALL_TIERS.map((t) => {
                const override = tierCfgQ.data?.client?.[t] ?? null;
                const fallback = tierCfgQ.data?.global[t] ?? [];
                const current = override ?? fallback;
                return (
                  <TierEditor
                    key={t}
                    tier={t}
                    initial={current}
                    saving={tierSaveMut.isPending}
                    onSave={(widgets) => tierSaveMut.mutate({ tier: t, widgets })}
                    onReset={override ? () => tierSaveMut.mutate({ tier: t, widgets: null }) : undefined}
                    resetLabel="Use default"
                    title={`${TIER_LABEL[t]} ${override ? "· custom for this client" : "· using default"}`}
                  />
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Danger zone">
          <Button
            variant="destructive"
            onClick={() => { if (confirm(`Delete client "${client.name}"? This cannot be undone.`)) deleteMut.mutate(); }}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Trash2 className="mr-2 h-4 w-4" /> Delete client
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">This removes the client and all viewer access. Linked Xero organisations stay connected and can be reused.</p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
