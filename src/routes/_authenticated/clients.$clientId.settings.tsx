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
  createClientViewerWithPassword,
  updateClientAccessTier,
  revokeClientAccess,
  updateClientReportBasis,
  updateClientBasisOverride,
  type BasisOverrideWidget,
} from "@/lib/clients.functions";
import { BasisSelect, type ReportBasis } from "@/components/dashboard/BasisSelect";
import { listTierConfig, saveTierWidgets, listTierSettings } from "@/lib/tier-config.functions";
import { listXeroConnections, startXeroConnect, disconnectXero } from "@/lib/xero/connections.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Loader2, UserPlus, Link2, KeyRound, Eye, EyeOff, Copy, AlertCircle } from "lucide-react";
import { ConnectWithXeroButton } from "@/components/xero/ConnectWithXeroButton";
import { ALL_TIERS, TIER_LABEL, type DashboardTier, type WidgetKey } from "@/lib/tiers";
import { TierEditor } from "@/routes/_authenticated/settings.tiers";
import { CostClassificationPanel } from "@/components/dashboard/CostClassificationPanel";
import { Switch } from "@/components/ui/switch";
import { listCostClassifications, setCostClassificationEnabled } from "@/lib/cost-classification.functions";

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
  const disconnect = useServerFn(disconnectXero);

  const rename = useServerFn(renameClient);
  const attach = useServerFn(attachXeroOrg);
  const detach = useServerFn(detachXeroOrg);
  const del = useServerFn(deleteClient);
  const invite = useServerFn(inviteClientViewer);
  const createViewerPw = useServerFn(createClientViewerWithPassword);
  const updateTier = useServerFn(updateClientAccessTier);
  const revoke = useServerFn(revokeClientAccess);
  const fetchTierCfg = useServerFn(listTierConfig);
  const saveTier = useServerFn(saveTierWidgets);
  const fetchTierSettings = useServerFn(listTierSettings);
  const fetchClassifications = useServerFn(listCostClassifications);
  const setClassEnabled = useServerFn(setCostClassificationEnabled);


  

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
  const [viewerMode, setViewerMode] = useState<"invite" | "password">("invite");
  const [viewerPassword, setViewerPassword] = useState("");
  const [showViewerPw, setShowViewerPw] = useState(false);
  const [lastViewerCreated, setLastViewerCreated] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (clientQ.data?.client?.name && name === "") setName(clientQ.data.client.name as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientQ.data?.client?.name]);

  useEffect(() => {
    if (enabledTiers.length && !enabledTiers.includes(inviteTier)) {
      setInviteTier(enabledTiers[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledTiers.join(",")]);

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
    onSuccess: () => { toast.success("Unlinked"); qc.invalidateQueries({ queryKey: ["client", clientId] }); qc.invalidateQueries({ queryKey: ["xero-connections"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const disconnectMut = useMutation({
    mutationFn: (tenantId: string) => disconnect({ data: { tenantId } }),
    onSuccess: () => {
      toast.success("Xero org disconnected");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["xero-connections"] });
    },
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

  const createViewerPwMut = useMutation({
    mutationFn: () => createViewerPw({ data: { clientId, email: inviteEmail, password: viewerPassword, tier: inviteTier } }),
    onSuccess: () => {
      toast.success(`Viewer created — ${inviteEmail}`);
      setLastViewerCreated({ email: inviteEmail, password: viewerPassword });
      setInviteEmail("");
      setViewerPassword("");
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
      const { authorizeUrl } = await startConnect({ data: { origin: window.location.origin, clientId } });
      if (authWindow) { authWindow.opener = null; authWindow.location.href = authorizeUrl; }
      else window.location.href = authorizeUrl;
    } catch (e: any) { authWindow?.close(); toast.error(e.message); }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("xero");
    const err = params.get("xero_error");
    if (status === "connected") {
      toast.success("Xero organisation linked");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["xero-connections"] });
    } else if (err === "multi_company_required") {
      toast.error("This client already has a Xero org linked. Grant the Multi company tier to link more.");
    } else if (err) {
      toast.error(err);
    }
    if (status || err) {
      params.delete("xero");
      params.delete("xero_error");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        {/* Report basis */}
        <Section title="Report basis">
          <p className="mb-3 text-xs text-muted-foreground">
            Sets the client's accounting basis. Below, choose which dashboard cards should use it instead of always reporting on Accrual. Viewers don't see any of this.
          </p>
          <BasisSelectRow clientId={clientId} current={(client.report_basis as ReportBasis) ?? "accrual"} />
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Per-card override
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Toggle ON to make that card follow the client's basis. OFF = always Accrual.
            </p>
            <BasisOverrideList
              clientId={clientId}
              clientBasis={(client.report_basis as ReportBasis) ?? "accrual"}
              overrides={(client.basis_overrides as Record<string, boolean> | null) ?? {}}
            />
          </div>
        </Section>




        {/* Xero orgs */}
        <Section title="Xero organisations" action={
          <ConnectWithXeroButton variant="connect" size="sm" onClick={handleConnect} label="Connect a Xero org" />
        }>
          <p className="mb-3 text-xs text-muted-foreground">
            If a widget says Xero needs reconnecting, use <strong>Reconnect to Xero</strong> — it re-runs Xero sign-in and refreshes the tokens for that org in place.
          </p>
          {linkedOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Xero orgs linked yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {linkedOrgs.map((o) => {
                const tenantId: string | undefined = o.xero_connections?.tenant_id;
                const tenantName: string = o.xero_connections?.tenant_name ?? "Unknown";
                const status: string = o.xero_connections?.status ?? "connected";
                const isDisconnected = status === "disconnected";
                return (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tenantName}</span>
                      {isDisconnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          <AlertCircle className="h-3 w-3" /> Reconnect required
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          Connected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ConnectWithXeroButton
                        variant={isDisconnected ? "reconnect" : "reconnect"}
                        size="sm"
                        onClick={handleConnect}
                        label={isDisconnected ? "Reconnect to Xero" : "Reconnect to Xero"}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" title="Disconnect">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect {tenantName}</AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>Unlink from this client</strong> removes the link only — the Xero connection stays available to link to other clients.
                              <br /><br />
                              <strong>Disconnect from Xero</strong> revokes our access at Xero and removes the connection here. Reconnecting requires a fresh Xero sign-in.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => detachMut.mutate(o.id)}>
                              Unlink from this client
                            </AlertDialogAction>
                            <AlertDialogAction
                              onClick={() => tenantId && disconnectMut.mutate(tenantId)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Disconnect from Xero
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                );
              })}
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
          <div className="mb-3 inline-flex rounded-md border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => { setViewerMode("invite"); setLastViewerCreated(null); }}
              className={`rounded px-3 py-1.5 transition ${viewerMode === "invite" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Send email invite
            </button>
            <button
              type="button"
              onClick={() => { setViewerMode("password"); setLastViewerCreated(null); }}
              className={`rounded px-3 py-1.5 transition ${viewerMode === "password" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Create with password
            </button>
          </div>

          {viewerMode === "invite" ? (
            <>
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
              <p className="mt-2 text-xs text-muted-foreground">
                If the email isn't registered yet, they'll receive an invite link.
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input type="email" placeholder="viewer@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" />
                  <Select value={inviteTier} onValueChange={(v) => setInviteTier(v as DashboardTier)}>
                    <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {enabledTiers.map((t) => (<SelectItem key={t} value={t}>{TIER_LABEL[t]}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  <Input
                    type={showViewerPw ? "text" : "password"}
                    placeholder="Starter password (min 8 chars, letter + number)"
                    value={viewerPassword}
                    onChange={(e) => setViewerPassword(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowViewerPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showViewerPw ? "Hide password" : "Show password"}
                  >
                    {showViewerPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={() => createViewerPwMut.mutate()}
                  disabled={!inviteEmail.includes("@") || viewerPassword.length < 8 || createViewerPwMut.isPending}
                  className="self-start"
                >
                  {createViewerPwMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Create viewer
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Account is active immediately — no email click required. Share the credentials securely; they can change the password from Account settings after signing in.
              </p>
              {lastViewerCreated && (
                <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs">
                  <div className="mb-2 font-medium text-foreground">New viewer credentials</div>
                  <div className="font-mono text-foreground">{lastViewerCreated.email}</div>
                  <div className="font-mono text-foreground">{lastViewerCreated.password}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={async () => {
                      const text = `Email: ${lastViewerCreated.email}\nPassword: ${lastViewerCreated.password}\nSign in: https://tractionadvisory.app/auth`;
                      try {
                        await navigator.clipboard.writeText(text);
                        toast.success("Credentials copied");
                      } catch {
                        window.prompt("Copy credentials:", text);
                      }
                    }}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" /> Copy credentials
                  </Button>
                </div>
              )}
            </>
          )}

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
        {/* Cost classification */}
        <CostClassificationSection
          clientId={clientId}
          linkedOrgs={linkedOrgs}
          fetchClassifications={fetchClassifications}
          setClassEnabled={setClassEnabled}
        />

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
              {enabledTiers.map((t) => {
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

function CostClassificationSection({
  clientId,
  linkedOrgs,
  fetchClassifications,
  setClassEnabled,
}: {
  clientId: string;
  linkedOrgs: any[];
  fetchClassifications: ReturnType<typeof useServerFn<typeof listCostClassifications>>;
  setClassEnabled: ReturnType<typeof useServerFn<typeof setCostClassificationEnabled>>;
}) {
  const qc = useQueryClient();
  const firstTenantId: string | undefined = linkedOrgs[0]?.xero_connections?.tenant_id;
  const enabledQ = useQuery({
    queryKey: ["cost-classification-enabled", clientId],
    queryFn: () => fetchClassifications({ data: { clientId, tenantId: firstTenantId ?? "" } }),
    enabled: !!firstTenantId,
  });
  const enabled = enabledQ.data?.enabled ?? true;

  const toggleMut = useMutation({
    mutationFn: (v: boolean) => setClassEnabled({ data: { clientId, enabled: v } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["cost-classification-enabled", clientId] });
      qc.invalidateQueries({ queryKey: ["cost-classifications", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section id="cost-classification" className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] scroll-mt-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Cost classification</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tag each expense account as <strong>Fixed</strong> or <strong>Variable</strong> so the
            Breakeven widget can split operating expenses correctly. Cost of Sales is always treated
            as variable. Unclassified accounts default to Fixed.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{enabled ? "On" : "Off"}</span>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => toggleMut.mutate(v)}
            disabled={toggleMut.isPending || enabledQ.isLoading}
            aria-label="Enable cost classification"
          />
        </div>
      </div>
      {!enabled ? (
        <p className="text-sm text-muted-foreground">
          Cost classification is turned off. The Breakeven widget treats all operating expenses as
          fixed, and Cost of Sales as variable.
        </p>
      ) : linkedOrgs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Link a Xero organisation first.</p>
      ) : (
        <div className="space-y-4">
          {linkedOrgs.map((o) => {
            const tenantId: string | undefined = o.xero_connections?.tenant_id;
            const tenantName: string = o.xero_connections?.tenant_name ?? "Unknown";
            if (!tenantId) return null;
            return (
              <CostClassificationPanel
                key={o.id}
                clientId={clientId}
                tenantId={tenantId}
                tenantName={tenantName}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function BasisSelectRow({ clientId, current }: { clientId: string; current: ReportBasis }) {
  const qc = useQueryClient();
  const updateBasisFn = useServerFn(updateClientReportBasis);
  const mut = useMutation({
    mutationFn: (basis: ReportBasis) => updateBasisFn({ data: { clientId, basis } }),
    onSuccess: (_d, basis) => {
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["xero-tax-buckets"] });
      qc.invalidateQueries({ queryKey: ["xero-pnl"] });
      toast.success(`Report basis set to ${basis === "cash" ? "Cash" : "Accrual"}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update basis"),
  });
  return (
    <BasisSelect value={current} onChange={(v) => mut.mutate(v)} disabled={mut.isPending} />
  );
}

const BASIS_OVERRIDE_WIDGETS: { key: BasisOverrideWidget; label: string; defaultOn?: boolean }[] = [
  { key: "pnl", label: "Profit & Loss" },
  { key: "tax_liability", label: "Tax Liabilities", defaultOn: true },
  { key: "superannuation", label: "Superannuation Liabilities" },
  { key: "receivables", label: "Aged Receivables" },
  { key: "payables", label: "Aged Payables" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "period_performance", label: "Period Performance" },
  { key: "accounting_breakeven", label: "Accounting Break-Even" },
  { key: "true_breakeven", label: "True Break-Even (Cash)" },
];

function BasisOverrideList({
  clientId,
  clientBasis,
  overrides,
}: {
  clientId: string;
  clientBasis: ReportBasis;
  overrides: Record<string, boolean>;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateClientBasisOverride);
  const mut = useMutation({
    mutationFn: (v: { widget: BasisOverrideWidget; enabled: boolean }) =>
      updateFn({ data: { clientId, widget: v.widget, enabled: v.enabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["xero-tax-buckets"] });
      qc.invalidateQueries({ queryKey: ["xero-pnl"] });
      qc.invalidateQueries({ queryKey: ["xero-super-balance"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update override"),
  });

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-background">
      {BASIS_OVERRIDE_WIDGETS.map((w) => {
        const enabled = overrides[w.key] ?? w.defaultOn ?? false;
        const effective = enabled ? clientBasis : "accrual";
        return (
          <li key={w.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{w.label}</p>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? `Uses client basis (${effective === "cash" ? "Cash" : "Accrual"})`
                  : "Always Accrual"}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => mut.mutate({ widget: w.key, enabled: v })}
              disabled={mut.isPending}
              aria-label={`Use client basis for ${w.label}`}
            />
          </li>
        );
      })}
    </ul>
  );
}


