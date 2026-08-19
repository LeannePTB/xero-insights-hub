import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, ChevronRight, Eye, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { listClients, deleteClient } from "@/lib/clients.functions";
import { listTierSettings, getFirmPlanSummary } from "@/lib/tier-config.functions";
import { getAllowedTiersForFirm } from "@/lib/plan-tiers.functions";
import { getSupportAccess } from "@/lib/support-access.functions";
import { getMyContext } from "@/lib/roles.functions";


import { ALL_TIERS, tierLabel, type DashboardTier } from "@/lib/tiers";
import { usePlanLevels } from "@/hooks/usePlanLevels";
import { ClientHealthBadge } from "@/components/dashboard/ClientHealthBadge";
import { Button } from "@/components/ui/button";
import { AddClientFromXeroButton } from "@/components/admin/AddClientFromXeroButton";
import { SetAllClientTiersDialog } from "@/components/admin/SetAllClientTiersDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Explains a tier that isn't a plain paid subscription. */
function sourceNote(ent: { source?: string; expiresAt?: string | null }): string | null {
  const when = ent.expiresAt
    ? new Date(ent.expiresAt).toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit" })
    : null;
  switch (ent.source) {
    case "trial":
      return when ? `trial · ends ${when}` : "trial";
    case "free_forever":
      return "comped";
    case "org_always_free":
      return "included";
    default:
      return null;
  }
}

/**
 * Clients for one organisation: list, add, open, settings, view-as and remove.
 * Shared by the organisation page and the admin "Plan & members" page so both
 * stay in sync. `showHealth` is off on admin surfaces that must not show
 * client financial data.
 */

export function FirmClientsSection({
  firmId,
  firmName,
  clientLimit,
  planLabel,
  showHealth = true,
  allowClientData = true,
  heading = "Clients",
  showAddActions = true,
  onChanged,
}: {
  firmId: string;
  firmName: string;
  clientLimit?: number;
  planLabel?: string;
  showHealth?: boolean;
  /** When false, nothing links through to client data; only gated "View as". */
  allowClientData?: boolean;
  heading?: string;
  /** When false, the add-client buttons are hidden (they live in settings). */
  showAddActions?: boolean;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const fetchClients = useServerFn(listClients);
  const fetchTierSettings = useServerFn(listTierSettings);
  const fetchPlanTiers = useServerFn(getAllowedTiersForFirm);
  const removeClient = useServerFn(deleteClient);
  const fetchSupportAccess = useServerFn(getSupportAccess);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const supportQ = useQuery({
    queryKey: ["support-access", firmId],
    queryFn: () => fetchSupportAccess({ data: { firmId } }),
    enabled: !allowClientData,
  });
  const canOpenClientData = allowClientData || !!supportQ.data?.viewerHasClientData;

  const fetchMyContext = useServerFn(getMyContext);
  const meQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchMyContext() });
  const isSuperAdmin = !!meQ.data?.isSuperAdmin;
  const isAdvisor = !!meQ.data?.isAdvisor;
  const canManageTier = isAdvisor || isSuperAdmin;




  const clientsQ = useQuery({
    queryKey: ["clients", firmId],
    queryFn: () => fetchClients({ data: { firmId } }),
  });
  const tierSettingsQ = useQuery({ queryKey: ["tier-settings"], queryFn: () => fetchTierSettings() });
  const fetchFirmPlan = useServerFn(getFirmPlanSummary);
  const firmPlanQ = useQuery({
    queryKey: ["firm-plan-summary", firmId],
    queryFn: () => fetchFirmPlan({ data: { firmId } }),
  });
  // Organisation default cards act as a ceiling for every client in the firm.
  const firmWidgets = firmPlanQ.data?.widgets ?? null;
  const healthAllowedByFirm = !firmWidgets || firmWidgets.includes("health");
  const planTiersQ = useQuery({
    queryKey: ["plan-tiers", "firm", firmId],
    queryFn: () => fetchPlanTiers({ data: { firmId } }),
  });

  const planTiers = planTiersQ.data?.allowed ?? null;
  const { levels: tierLevels } = usePlanLevels("dashboard");
  const catalogueKeys = (tierLevels.length ? tierLevels.map((l) => l.key) : [...ALL_TIERS]) as DashboardTier[];
  const labelFor = (t: string) => tierLabel(t, tierLevels.find((l) => l.key === t)?.label);
  const enabledTiers = catalogueKeys.filter(
    (t) =>
      (tierLevels.find((l) => l.key === t)?.enabled ?? true) &&
      (tierSettingsQ.data?.enabled?.[t] ?? true) &&
      (!planTiers || planTiers.includes(t)),
  );

  const deleteMut = useMutation({
    mutationFn: (clientId: string) => removeClient({ data: { clientId } }),
    onSuccess: () => {
      toast.success("Client removed");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["clients", firmId] });
      qc.invalidateQueries({ queryKey: ["my-firm", firmId] });
      onChanged?.();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not remove client"),
  });

  const clients = clientsQ.data?.clients ?? [];
  const atLimit = typeof clientLimit === "number" && clients.length >= clientLimit;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">{heading}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <SetAllClientTiersDialog
            firmId={firmId}
            clientCount={clients.length}
            options={enabledTiers.map((t) => ({ key: t, label: labelFor(t) }))}
          />
        </div>
        {showAddActions && (
          <div className="flex items-center gap-3">
            {atLimit && (
              <span className="text-xs text-muted-foreground">
                Client limit reached — upgrade the plan to add more.
              </span>
            )}
            <AddClientFromXeroButton firmId={firmId} disabled={atLimit} />
            <Button variant="outline" asChild={!atLimit} disabled={atLimit}>
              {atLimit ? (
                <span><Plus className="mr-2 h-4 w-4" /> New client</span>
              ) : (
                <Link to="/clients/new" search={{ firmId } as any}>
                  <Plus className="mr-2 h-4 w-4" /> New client
                </Link>
              )}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove client</DialogTitle>
            <DialogDescription>
              Remove “{pendingDelete?.name}” from {firmName}? This deletes the client and all viewer
              access. Linked Xero organisations stay connected and can be reused.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
            >
              {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove client
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-6">
        {clientsQ.isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : clients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold">Create your first client</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              A client is a company you track. Each client can hold one or more Xero organisations.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {showAddActions ? (
                <>
                  <AddClientFromXeroButton firmId={firmId} />
                  <Button variant="outline" asChild>
                    <Link to="/clients/new" search={{ firmId } as any}>
                      <Plus className="mr-2 h-4 w-4" /> New client
                    </Link>
                  </Button>
                </>
              ) : (
                <Button variant="outline" asChild>
                  <Link to="/firms/$firmId/settings" params={{ firmId }}>
                    <Plus className="mr-2 h-4 w-4" /> Add clients in settings
                  </Link>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Tier</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c: any) => {
                  const ent = c.entitlement ?? { tier: "basic", source: "none", expiresAt: null };
                  const effectiveTier: string = ent.tier ?? "basic";
                  // Only a super admin may preview a tier the client is not on,
                  // and only within what the organisation's plan permits.
                  const previewTiers = (isSuperAdmin ? enabledTiers : []).filter(
                    (t) => t !== effectiveTier,
                  );

                  const tenantIds = (c.client_xero_orgs ?? [])
                    .map((o: any) => o.xero_connections?.tenant_id)
                    .filter(Boolean);
                  const tenantNames = (c.client_xero_orgs ?? [])
                    .map((o: any) => o.xero_connections?.tenant_name)
                    .filter(Boolean)
                    .join(", ");
                  const nameBlock = (
                    <>
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium leading-tight group-hover:text-primary transition-colors">
                          {c.name}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground truncate">
                          {tenantNames || "No Xero org linked"}
                        </div>
                        {canOpenClientData && showHealth && healthAllowedByFirm &&
                          (c.clientWidgets === null || c.clientWidgets?.includes("health")) && (
                            <ClientHealthBadge tenantId={tenantIds[0] ?? null} />
                          )}
                      </div>
                    </>
                  );
                  return (
                    <tr key={c.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        {canOpenClientData ? (
                          <Link
                            to="/clients/$clientId"
                            params={{ clientId: c.id }}
                            search={{ firmId }}
                            className="flex items-center gap-3 group"
                          >
                            {nameBlock}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3">{nameBlock}</div>
                        )}

                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          {labelFor(effectiveTier)}
                        </span>
                        {sourceNote(ent) && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{sourceNote(ent)}</div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canOpenClientData && (
                            <Link
                              to="/clients/$clientId"
                              params={{ clientId: c.id }}
                              search={{ firmId }}
                              className="inline-flex items-center text-muted-foreground hover:text-foreground"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${c.name}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canOpenClientData && (
                                <>
                                  <DropdownMenuItem asChild>
                                    <Link to="/clients/$clientId" params={{ clientId: c.id }}>Open</Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link to="/clients/$clientId/settings" params={{ clientId: c.id }}>Settings</Link>
                                  </DropdownMenuItem>
                                </>
                              )}
                              {[effectiveTier, ...previewTiers].map((t) =>
                                canOpenClientData ? (
                                  <DropdownMenuItem key={`view-as-${t}`} asChild>
                                    <Link to="/clients/$clientId" params={{ clientId: c.id }} search={{ viewAs: t }}>
                                      <Eye className="mr-2 h-4 w-4" /> View as {labelFor(t)} client
                                      {t !== effectiveTier && (
                                        <span className="ml-1 text-xs text-muted-foreground">(preview)</span>
                                      )}
                                    </Link>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    key={`view-as-${t}`}
                                    disabled
                                    title="This organisation hasn't granted support access"
                                  >
                                    <Eye className="mr-2 h-4 w-4" /> View as {labelFor(t)} client
                                  </DropdownMenuItem>
                                ),
                              )}


                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setPendingDelete({ id: c.id, name: c.name });
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Remove client
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
