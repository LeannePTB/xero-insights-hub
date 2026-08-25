import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { SuperAdminChip } from "@/components/admin/SuperAdminOnly";
import { useEffect } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getClient,
  renameClient,
  detachXeroOrg,
  deleteClient,
  listClientAccess,
  inviteClientViewer,
  createClientViewerWithPassword,
  updateClientAccessTier,
  revokeClientAccess,
  updateClientReportBasis,
  setClientXeroAllowance,
} from "@/lib/clients.functions";
import { BasisSelect, type ReportBasis } from "@/components/dashboard/BasisSelect";
import { FIXED_CARD_BASIS, FIXED_CARD_BASIS_LABELS, basisLabel } from "@/lib/report-basis";
import { getXeroSalesTaxBasis } from "@/lib/xero/org-basis.functions";
import { listTierConfig, saveClientTierWidgets, listTierSettings } from "@/lib/tier-config.functions";
import { getAllowedTiersForClient } from "@/lib/plan-tiers.functions";
import { getMyContext } from "@/lib/roles.functions";

import {
  startXeroConnect,
  disconnectXero,
  listClientXeroOptions,
  linkClientXeroOptions,
  moveXeroFileToClient,
} from "@/lib/xero/connections.functions";
import { listXeroScopeStatus, type XeroScopeStatus } from "@/lib/xero/scope-status.functions";
import { capabilityList } from "@/lib/xero/scope-capabilities";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePersistedDisclosure, sectionStorageKey } from "@/hooks/usePersistedDisclosure";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ClientSubscriptionSection } from "@/components/billing/ClientSubscriptionSection";
import { LogoUploadCard } from "@/components/branding/LogoUploadCard";
import { ClientDashboardTierControl } from "@/components/billing/ClientDashboardTierControl";
import { ClientCardsPanel } from "@/components/billing/ClientCardsPanel";
import {
  ArrowLeft,
  Trash2,
  Loader2,
  UserPlus,
  Link2,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { ConnectWithXeroButton } from "@/components/xero/ConnectWithXeroButton";
import { ALL_TIERS, tierLabel, type DashboardTier, type WidgetKey } from "@/lib/tiers";
import { usePlanLevels } from "@/hooks/usePlanLevels";
import { TierEditor } from "@/routes/_authenticated/settings.tiers";
import { CostClassificationPanel } from "@/components/dashboard/CostClassificationPanel";
import { getClientWidgets } from "@/lib/tier-config.functions";
// import { SubscriptionPanel } from "@/components/billing/SubscriptionPanel";
import { Switch } from "@/components/ui/switch";
import {
  listCostClassifications,
  setCostClassificationEnabled,
} from "@/lib/cost-classification.functions";

export const Route = createFileRoute("/_authenticated/clients/$clientId/settings")({
  head: () => ({ meta: [{ title: "Client settings — Traction Advisory" }] }),
  component: ClientSettings,
});

function ClientSettings() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchClient = useServerFn(getClient);
  const fetchAccess = useServerFn(listClientAccess);
  const fetchXeroOptions = useServerFn(listClientXeroOptions);
  const linkXeroOptions = useServerFn(linkClientXeroOptions);
  const moveXeroFile = useServerFn(moveXeroFileToClient);
  const saveXeroAllowance = useServerFn(setClientXeroAllowance);
  const startConnect = useServerFn(startXeroConnect);
  const disconnect = useServerFn(disconnectXero);

  const rename = useServerFn(renameClient);
  const detach = useServerFn(detachXeroOrg);
  const del = useServerFn(deleteClient);
  const invite = useServerFn(inviteClientViewer);
  const createViewerPw = useServerFn(createClientViewerWithPassword);
  const updateTier = useServerFn(updateClientAccessTier);
  const revoke = useServerFn(revokeClientAccess);
  const fetchTierCfg = useServerFn(listTierConfig);
  const saveTier = useServerFn(saveClientTierWidgets);
  const fetchTierSettings = useServerFn(listTierSettings);
  const fetchClassifications = useServerFn(listCostClassifications);
  const setClassEnabled = useServerFn(setCostClassificationEnabled);

  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient({ data: { clientId } }),
  });
  const chooserState =
    typeof window === "undefined"
      ? undefined
      : (new URLSearchParams(window.location.search).get("state") ?? undefined);
  const optionsQ = useQuery({
    queryKey: ["client-xero-options", clientId, chooserState],
    queryFn: () => fetchXeroOptions({ data: { clientId, state: chooserState } }),
  });
  const accessQ = useQuery({
    queryKey: ["client-access", clientId],
    queryFn: () => fetchAccess({ data: { clientId } }),
  });
  const tierCfgQ = useQuery({
    queryKey: ["tier-config", clientId],
    queryFn: () => fetchTierCfg({ data: { clientId } }),
  });
  const tierSettingsQ = useQuery({
    queryKey: ["tier-settings"],
    queryFn: () => fetchTierSettings(),
  });
  const fetchPlanTiers = useServerFn(getAllowedTiersForClient);
  const planTiersQ = useQuery({
    queryKey: ["plan-tiers", "client", clientId],
    queryFn: () => fetchPlanTiers({ data: { clientId } }),
  });
  const planTiers = planTiersQ.data?.allowed ?? null;
  const fetchMyContext = useServerFn(getMyContext);
  const myCtxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchMyContext() });
  const isSuperAdmin = !!myCtxQ.data?.isSuperAdmin;

  const fetchScopeStatus = useServerFn(listXeroScopeStatus);
  const scopeStatusQ = useQuery({
    queryKey: ["xero-scope-status"],
    queryFn: () => fetchScopeStatus(),
  });
  const missingScopesByTenant = new Map<string, string[]>(
    ((scopeStatusQ.data?.connections ?? []) as XeroScopeStatus[])
      .filter((c) => c.missingScopes.length > 0)
      .map((c) => [c.tenantId, c.missingScopes] as [string, string[]]),
  );



  // Only offer tiers the organisation's plan includes.
  const { levels: tierLevels } = usePlanLevels("dashboard");
  const catalogueKeys = (tierLevels.length ? tierLevels.map((l) => l.key) : [...ALL_TIERS]) as DashboardTier[];
  const labelFor = (t: string) => tierLabel(t, tierLevels.find((l) => l.key === t)?.label);
  const enabledTiers = catalogueKeys.filter(
    (t) =>
      (tierLevels.find((l) => l.key === t)?.enabled ?? true) &&
      (tierSettingsQ.data?.enabled?.[t] ?? true) &&
      (!planTiers || planTiers.includes(t)),
  );

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
  const [lastViewerCreated, setLastViewerCreated] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [selectedXeroIds, setSelectedXeroIds] = useState<Set<string>>(new Set());
  const [xeroAllowance, setXeroAllowance] = useState(1);

  useEffect(() => {
    if (clientQ.data?.client?.name && name === "") setName(clientQ.data.client.name as string);
    if (clientQ.data?.client?.max_xero_orgs)
      setXeroAllowance(clientQ.data.client.max_xero_orgs as number);
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
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const linkOptionsMut = useMutation({
    mutationFn: () =>
      linkXeroOptions({
        data: { clientId, state: chooserState ?? "", connectionIds: [...selectedXeroIds] },
      }),
    onSuccess: ({ linked }) => {
      toast.success(`${linked} Xero organisation${linked === 1 ? "" : "s"} linked`);
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      window.history.replaceState({}, "", window.location.pathname);
      setSelectedXeroIds(new Set());
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveXeroMut = useMutation({
    mutationFn: (connectionId: string) => moveXeroFile({ data: { clientId, connectionId } }),
    onSuccess: () => {
      toast.success("Xero file moved to this subscription");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["client-xero-options", clientId] });
      qc.invalidateQueries({ queryKey: ["xero-connections"] });
      window.history.replaceState({}, "", window.location.pathname);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const allowanceMut = useMutation({
    mutationFn: () => saveXeroAllowance({ data: { clientId, allowance: xeroAllowance } }),
    onSuccess: () => {
      toast.success("Xero file allowance saved");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["client-xero-options", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const detachMut = useMutation({
    mutationFn: (id: string) => detach({ data: { id } }),
    onSuccess: () => {
      toast.success("Unlinked");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["xero-connections"] });
    },
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
    onSuccess: () => {
      toast.success("Client deleted");
      navigate({ to: "/dashboard", replace: true });
    },
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
    mutationFn: () =>
      createViewerPw({
        data: { clientId, email: inviteEmail, password: viewerPassword, tier: inviteTier },
      }),
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
    mutationFn: ({ id, tier }: { id: string; tier: DashboardTier }) =>
      updateTier({ data: { id, tier } }),
    onSuccess: () => {
      toast.success("Tier updated");
      qc.invalidateQueries({ queryKey: ["client-access", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Access removed");
      qc.invalidateQueries({ queryKey: ["client-access", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleConnect(opts?: { tenantId?: string }) {
    const authWindow = window.open("about:blank", "_blank");
    try {
      const { authorizeUrl } = await startConnect({
        data: {
          origin: window.location.origin,
          clientId,
          // Reauthorising an existing file is never a new file, so it must not
          // be gated by the organisation's Xero file allowance.
          mode: opts?.tenantId ? "reconnect" : "new",
          tenantId: opts?.tenantId,
        },
      });
      if (authWindow) {
        authWindow.opener = null;
        authWindow.location.href = authorizeUrl;
      } else window.location.href = authorizeUrl;
    } catch (e: any) {
      authWindow?.close();
      toast.error(e.message);
    }
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
    } else if (status === "reconnected") {
      toast.success("Xero organisation reconnected");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["xero-connections"] });
      qc.invalidateQueries({ queryKey: ["xero-scope-status"] });
    } else if (status === "choose") {
      toast.info("Choose which Xero files belong to this subscription.");

    } else if (err) {
      toast.error(err);
    }
    if ((status && status !== "choose") || err) {
      params.delete("xero");
      params.delete("xero_error");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.replace("#", "") !== "dashboard-tier") return;
    const el = document.getElementById("dashboard-tier");
    if (!el) return;
    // Give the layout a beat to settle before scrolling to the target.
    const t = setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    return () => clearTimeout(t);
  }, [clientId]);

  if (clientQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  const client = clientQ.data?.client;
  if (!client) return <p className="p-6 text-sm text-destructive">Client not found.</p>;

  const linkedOrgs: any[] = client.client_xero_orgs ?? [];
  const availableConns = optionsQ.data?.connections ?? [];
  const allowance = optionsQ.data?.allowance;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/clients/$clientId" params={{ clientId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-semibold">{client.name} · Client settings</h1>
        </div>

        {/* Name */}
        <Section title="Client name">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              onClick={() => renameMut.mutate()}
              disabled={!name.trim() || name === client.name || renameMut.isPending}
            >
              {renameMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </div>
        </Section>

        {/* Subscription */}
        <Section title="Subscription" collapsible>
          <ClientSubscriptionSection clientId={clientId} />
        </Section>

        {/* Dashboard tier — what this client sees */}
        <Section
          title="Dashboard tier"
          id="dashboard-tier"
          collapsible
          action={
            isSuperAdmin ? (
              <div className="flex items-center gap-2">
                <SuperAdminChip />
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/settings/tiers">Edit plan defaults</Link>
                </Button>
              </div>
            ) : undefined
          }
        >
          <ClientDashboardTierControl clientId={clientId} />
        </Section>

        {/* Cards — per-client switches within the tier */}
        <Section title="Cards" id="cards" collapsible>
          <ClientCardsPanel clientId={clientId} />
        </Section>


        {/* Report branding */}
        <Section title="Report branding" collapsible>
          <LogoUploadCard
            scope="client"
            id={clientId}
            description="Client logo shown alongside the organisation logo in the monthly management report PDF. PNG or JPEG, up to 2 MB. Reports still generate without a logo."
          />
        </Section>

        {/* Report basis */}
        <Section title="Report basis" collapsible>
          <ReportBasisSection
            clientId={clientId}
            clientBasis={(client.report_basis as ReportBasis) ?? "accrual"}
            tenantId={linkedOrgs.find((o: any) => o.xero_connections?.tenant_id)?.xero_connections
              ?.tenant_id}
          />
        </Section>

        {/* Xero orgs */}
        <Section
          title="Xero organisations"
          action={
            <ConnectWithXeroButton
              variant="connect"
              size="sm"
              onClick={() => handleConnect()}
              label="Connect a Xero file"
            />
          }
        >
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
            <div>
              <Label htmlFor="xero-file-allowance">Allowed Xero files</Label>
              <Input
                id="xero-file-allowance"
                type="number"
                min={1}
                max={100}
                value={xeroAllowance}
                onChange={(event) => setXeroAllowance(Number(event.target.value))}
                className="mt-1 w-28"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => allowanceMut.mutate()}
              disabled={allowanceMut.isPending}
            >
              Save allowance
            </Button>
            {allowance ? (
              <p className="pb-2 text-xs text-muted-foreground">
                {allowance.used} of {allowance.allowance} linked
                {allowance.isMulti
                  ? ` · ${allowance.sourceLabel ?? "Multi company"} tier — ${allowance.allowance} Xero files`
                  : " · standard (single Xero file)"}
              </p>
            ) : null}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            If a widget says Xero needs reconnecting, use <strong>Reconnect to Xero</strong> — it
            re-runs Xero sign-in and refreshes the tokens for that org in place.
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
                const missingScopes = tenantId
                  ? (missingScopesByTenant.get(tenantId) ?? [])
                  : [];
                return (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
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
                        onClick={() => handleConnect({ tenantId })}
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
                              <strong>Unlink from this client</strong> removes the link only — the
                              Xero connection stays available to link to other clients.
                              <br />
                              <br />
                              <strong>Disconnect from Xero</strong> revokes our access at Xero and
                              removes the connection here. Reconnecting requires a fresh Xero
                              sign-in.
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
                    {missingScopes.length > 0 ? (
                      <div className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                        <p className="font-semibold text-amber-700 dark:text-amber-400">
                          This connection needs reauthorising to enable additional reports.
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Currently unavailable for this organisation: {capabilityList(missingScopes)}.
                          Reconnecting grants read-only access only — nothing is lost, and
                          everything working today keeps working.
                        </p>
                        <div className="mt-2">
                          <ConnectWithXeroButton
                            variant="reconnect"
                            size="sm"
                            onClick={() => handleConnect({ tenantId })}
                            label="Reconnect"
                          />
                        </div>
                      </div>
                    ) : null}
                  </li>

                );
              })}
            </ul>
          )}
          {chooserState && availableConns.length === 0 && !optionsQ.isFetching && (
            <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Those Xero files belong to another organisation, so they can't be linked here. Run
              "Connect a Xero file" again and tick an organisation that belongs to this
              organisation's subscription.
            </p>
          )}
          {chooserState && availableConns.length > 0 && (allowance?.remaining ?? 0) < 1 && (
            <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              This subscription is using {allowance?.used ?? 0} of {allowance?.allowance ?? 0} Xero
              file{(allowance?.allowance ?? 0) === 1 ? "" : "s"} allowed on its plan, so no more can
              be linked. Upgrade the organisation's plan to add another Xero file.
            </p>
          )}
          {chooserState && availableConns.length > 0 && (allowance?.remaining ?? 0) >= 1 && (
            <div className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-3">
              <p className="mb-2 text-sm font-semibold">Choose files for this subscription</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Only the files selected here will be visible to this client's users. You can select
                up to {allowance?.remaining ?? 0}.
              </p>
              <ul className="space-y-1">
                {availableConns.map((c: any) => {
                  const disabled = c.available === false;
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <label
                        className={`flex flex-1 items-center gap-3 rounded-md px-2 py-2 ${disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/50"}`}
                      >
                        <Checkbox
                          disabled={disabled}
                          checked={selectedXeroIds.has(c.id)}
                          onCheckedChange={() => {
                            if (disabled) return;
                            setSelectedXeroIds((current) => {
                              const next = new Set(current);
                              if (next.has(c.id)) next.delete(c.id);
                              else if (next.size < (allowance?.remaining ?? 0)) next.add(c.id);
                              return next;
                            });
                          }}
                        />
                        <span className="text-sm font-medium">{c.tenant_name}</span>
                        {disabled && (
                          <span className="text-xs text-muted-foreground">
                            {c.linkedToThisClient
                              ? "Already linked to this subscription"
                              : `Linked to ${c.linkedClientName ?? "another subscription"}${c.linkedFirmName ? ` — ${c.linkedFirmName}` : ""}`}
                          </span>
                        )}
                        {!disabled && (
                          <span className="text-xs text-muted-foreground">Available</span>
                        )}
                      </label>
                      {c.movable && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={moveXeroMut.isPending || (allowance?.remaining ?? 0) < 1}
                            >
                              Move here
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Move {c.tenant_name} to this subscription?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                It will be unlinked from{" "}
                                {c.linkedClientName ?? "its current subscription"}
                                {c.linkedFirmName ? ` (${c.linkedFirmName})` : ""} and its users
                                will lose access to this Xero file.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => moveXeroMut.mutate(c.id)}>
                                Move file
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Button
                className="mt-3"
                onClick={() => linkOptionsMut.mutate()}
                disabled={selectedXeroIds.size === 0 || linkOptionsMut.isPending}
              >
                <Link2 className="mr-2 h-4 w-4" /> Link selected
              </Button>
            </div>
          )}
        </Section>

        {/* Viewer access */}
        <Section title="Viewer access">
          <div className="mb-3 inline-flex rounded-md border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setViewerMode("invite");
                setLastViewerCreated(null);
              }}
              className={`rounded px-3 py-1.5 transition ${viewerMode === "invite" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Send email invite
            </button>
            <button
              type="button"
              onClick={() => {
                setViewerMode("password");
                setLastViewerCreated(null);
              }}
              className={`rounded px-3 py-1.5 transition ${viewerMode === "password" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Create with password
            </button>
          </div>

          {viewerMode === "invite" ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  placeholder="viewer@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                />
                <Select value={inviteTier} onValueChange={(v) => setInviteTier(v as DashboardTier)}>
                  <SelectTrigger className="sm:w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledTiers.map((t) => (
                      <SelectItem key={t} value={t}>
                        {labelFor(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => inviteMut.mutate()}
                  disabled={!inviteEmail.includes("@") || inviteMut.isPending}
                >
                  {inviteMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}{" "}
                  Invite
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
                  <Input
                    type="email"
                    placeholder="viewer@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={inviteTier}
                    onValueChange={(v) => setInviteTier(v as DashboardTier)}
                  >
                    <SelectTrigger className="sm:w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {enabledTiers.map((t) => (
                        <SelectItem key={t} value={t}>
                          {labelFor(t)}
                        </SelectItem>
                      ))}
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
                  disabled={
                    !inviteEmail.includes("@") ||
                    viewerPassword.length < 8 ||
                    createViewerPwMut.isPending
                  }
                  className="self-start"
                >
                  {createViewerPwMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Create viewer
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Account is active immediately — no email click required. Share the credentials
                securely; they can change the password from Account settings after signing in.
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
                      const text = `Email: ${lastViewerCreated.email}\nPassword: ${lastViewerCreated.password}\nSign in: https://tractionadvisory.com.au/auth`;
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
              <div className="text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (accessQ.data?.access ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No viewers yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {(accessQ.data?.access ?? []).map((a: any) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.display_name ?? a.email ?? a.user_id}
                      </p>
                      {a.email && a.display_name && (
                        <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={a.tier}
                        onValueChange={(v) =>
                          tierMut.mutate({ id: a.id, tier: v as DashboardTier })
                        }
                      >
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {enabledTiers.map((t) => (
                            <SelectItem key={t} value={t}>
                              {labelFor(t)}
                            </SelectItem>
                          ))}
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

        <Section title="Danger zone">
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(`Delete client "${client.name}"? This cannot be undone.`))
                deleteMut.mutate();
            }}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Trash2 className="mr-2 h-4 w-4" /> Delete client
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            This removes the client and all viewer access. Linked Xero organisations stay connected
            and can be reused.
          </p>
        </Section>

      </main>
    </div>
  );
}

function Section({
  title,
  action,
  collapsible,
  defaultOpen = false,
  storageKey,
  id,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  storageKey?: string;
  id?: string;
  children: React.ReactNode;
}) {
  const key = storageKey ?? sectionStorageKey("client-settings", title);
  // A deep link to this section (e.g. /clients/x/settings#dashboard-tier) opens it.
  const hashTargeted =
    typeof window !== "undefined" && !!id && window.location.hash.replace("#", "") === id;
  const [open, setOpen] = usePersistedDisclosure(key, {
    forceOpen: hashTargeted || defaultOpen,
  });

  if (!collapsible) {
    return (
      <section id={id} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {action}
        </div>
        {children}
      </section>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section id={id} className="scroll-mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <button className="group flex flex-1 items-center justify-between gap-2 text-left">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
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
  // Only show this where something actually consumes it. Break-even and the
  // cash-flow scenario need Fixed/Variable/Excluded; Business Health only needs
  // the Wages marker.
  const fetchWidgets = useServerFn(getClientWidgets);
  const widgetsQ = useQuery({
    queryKey: ["client-widgets", clientId, "cost-classification"],
    queryFn: () => fetchWidgets({ data: { clientId } }),
  });
  const allowed = new Set((widgetsQ.data?.widgets ?? []) as string[]);
  const usesCostSplit =
    allowed.has("accounting_breakeven") ||
    allowed.has("true_breakeven") ||
    allowed.has("cashflow_scenario");
  const usesWages = allowed.has("health");
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

  const [open, setOpen] = usePersistedDisclosure(
    sectionStorageKey("client-settings", "Cost classification"),
    {
      forceOpen:
        typeof window !== "undefined" &&
        window.location.hash.replace("#", "") === "cost-classification",
    },
  );

  if (widgetsQ.isLoading) return null;
  if (!usesCostSplit && !usesWages) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section
        id="cost-classification"
        className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] scroll-mt-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <CollapsibleTrigger asChild>
            <button className="group flex-1 text-left">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">Cost classification</h2>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {usesCostSplit ? (
                  <>
                    Tag each expense account as <strong>Fixed</strong>, <strong>Variable</strong>,
                    or <strong>Excluded</strong> for break-even and the cash-flow scenario. Use the
                    separate <strong>Wages</strong> marker for Business Health only; it does not
                    change fixed-cost treatment.
                  </>
                ) : (
                  <>
                    Mark which accounts are <strong>Wages</strong> for Business Health. This
                    client's dashboard has no break-even cards, so there is nothing to split into
                    fixed and variable.
                  </>
                )}
              </p>
            </button>
          </CollapsibleTrigger>
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
        <CollapsibleContent>
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
                    wagesOnly={!usesCostSplit}
                  />
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </section>
    </Collapsible>
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
  return <BasisSelect value={current} onChange={(v) => mut.mutate(v)} disabled={mut.isPending} />;
}

/**
 * Report basis card. The default comes from the Xero file's sales tax basis;
 * the client's basis can override it because a file's GST basis is not
 * necessarily its reporting basis. Only Profit & Loss keeps a per-card choice —
 * every other card has one correct basis, stated here as a fact.
 */
function ReportBasisSection({
  clientId,
  clientBasis,
  tenantId,
}: {
  clientId: string;
  clientBasis: ReportBasis;
  tenantId?: string;
}) {
  const salesTaxBasisFn = useServerFn(getXeroSalesTaxBasis);
  const xeroQ = useQuery({
    queryKey: ["xero-sales-tax-basis", tenantId],
    enabled: !!tenantId,
    staleTime: 30 * 60 * 1000,
    queryFn: () => salesTaxBasisFn({ data: { tenantId: tenantId! } }),
  });
  const xeroBasis = xeroQ.data?.basis ?? null;
  const xeroRaw = xeroQ.data?.raw ?? null;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-3 text-xs text-muted-foreground">
          The default comes from the Xero file. Override it if the client's reports are prepared on
          a different basis — plenty of businesses report GST on cash and have their Profit &amp;
          Loss prepared on accruals. Viewers don't see any of this.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <BasisSelectRow clientId={clientId} current={clientBasis} />
          <p className="text-xs text-muted-foreground">
            {xeroQ.isLoading
              ? "Reading the basis from Xero…"
              : xeroBasis
                ? `From Xero: ${basisLabel(xeroBasis)}`
                : `Basis could not be read from Xero${xeroRaw ? ` (SalesTaxBasis: ${xeroRaw})` : ""} — defaulting to Accrual`}
          </p>
        </div>
        <p className="mt-2 text-xs font-medium">
          In force: {basisLabel(clientBasis)}
          {xeroBasis && xeroBasis !== clientBasis ? " — overrides the Xero basis" : ""}
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          How each card reports
        </p>
        <ul className="divide-y divide-border rounded-lg border border-border bg-background">
          <li className="px-3 py-2.5">
            <p className="text-sm font-medium">Profit &amp; Loss</p>
            <p className="text-xs text-muted-foreground">
              Follows the client's basis ({basisLabel(clientBasis)})
            </p>
          </li>
          <li className="px-3 py-2.5">
            <p className="text-sm font-medium">GST Reconciliation</p>
            <p className="text-xs text-muted-foreground">
              Follows the GST basis in Xero
              {xeroBasis ? ` (${basisLabel(xeroBasis)})` : " (not readable — using Accrual)"}
            </p>
          </li>
          {FIXED_CARD_BASIS_LABELS.map((c) => (
            <li key={c.key} className="px-3 py-2.5">
              <p className="text-sm font-medium">
                {c.label} · always {basisLabel(FIXED_CARD_BASIS[c.key])}
              </p>
              <p className="text-xs text-muted-foreground">{c.reason}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
