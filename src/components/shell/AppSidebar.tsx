import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Briefcase,
  Building2,
  ChevronRight,
  FileText,
  LayoutGrid,
  Landmark,
  MessageCircle,
  Layers,
  Link2,
  Lock,
  LogOut,
  Palette,
  Settings,
  Shield,
  TrendingUp,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SecurityStatusCard } from "@/components/admin/SecurityStatusCard";
import { getMyContext } from "@/lib/roles.functions";
import { listMyFirms } from "@/lib/firms.functions";
import { getClient } from "@/lib/clients.functions";
import { getMyClientCapabilities } from "@/lib/roles.functions";
import { getMyClientVisibleCards, getMyLoansAccess, getMyLockedModules } from "@/lib/card-model.functions";
import { useSignOut } from "@/lib/use-sign-out";

import { useRef } from "react";
import {
  isBranchActive,
  isItemActive,
  navForWorkspace,
  resolveWorkspace,
  workspaceFromPath,
  type NavIcon,
  type NavItem,
  type Workspace,
} from "@/lib/nav/sidebar-nav";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import taMonogram from "@/assets/traction-ta-monogram.png";

const ICONS: Record<NavIcon, LucideIcon> = {
  building: Building2,
  layers: Layers,
  users: Users,
  palette: Palette,
  shield: Shield,
  activity: Activity,
  grid: LayoutGrid,
  briefcase: Briefcase,
  link: Link2,
  settings: Settings,
  chart: BarChart3,
  file: FileText,
  trending: TrendingUp,
  landmark: Landmark,
  message: MessageCircle,
  lock: Lock,
};

export function AppSidebar({ badges = {} }: { badges?: Record<string, number> }) {
  const signOut = useSignOut();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Visibility comes only from server signals.
  const fetchCtx = useServerFn(getMyContext);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const fetchFirms = useServerFn(listMyFirms);
  const firmsQ = useQuery({ queryKey: ["nav-my-firms"], queryFn: () => fetchFirms(), staleTime: 5 * 60_000 });
  const canSeeSystem = ctxQ.data?.isSuperAdmin === true;
  const organisations = firmsQ.data?.firms ?? [];

  // The address decides the workspace. Account pages (workspace-neutral) keep
  // the menu the person was last using; on a fresh load of one of those pages
  // we pick a neutral default — never "the first organisation".
  const lastWorkspace = useRef<Workspace>({ kind: "none" });
  let workspace: Workspace = resolveWorkspace(pathname, lastWorkspace.current);
  if (workspace.kind === "none") {
    if (organisations.length === 1) workspace = { kind: "organisation", firmId: organisations[0].id };
    else if (organisations.length > 1) workspace = { kind: "all" };
    else if (canSeeSystem) workspace = { kind: "system" };
  }
  if (workspaceFromPath(pathname).kind !== "none") lastWorkspace.current = workspace;
  const params: Record<string, string> =
    workspace.kind === "organisation"
      ? { firmId: workspace.firmId }
      : workspace.kind === "client"
        ? { clientId: workspace.clientId }
        : {};
  // Client Xero files come from the existing guarded getClient call (same cache as the dashboard).
  const fetchClient = useServerFn(getClient);
  const clientId = workspace.kind === "client" ? workspace.clientId : null;
  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient({ data: { clientId: clientId! } }),
    enabled: !!clientId,
    retry: false,
  });
  const clientFiles = (((clientQ.data as any)?.client?.client_xero_orgs ?? []) as any[])
    .map((o) => o?.xero_connections)
    .filter((c) => c?.tenant_id)
    .map((c) => ({ tenantId: c.tenant_id as string, name: (c.tenant_name as string) || "Xero file" }));
  const fetchCanManage = useServerFn(getMyClientCapabilities);
  const manageQ = useQuery({
    queryKey: ["can-manage-client", clientId],
    queryFn: () => fetchCanManage({ data: { clientId: clientId! } }),
    enabled: !!clientId,
    retry: false,
  });
  // Owning organisation comes from the caller-scoped client read, never the URL.
  const clientRow = (clientQ.data as any)?.client as { name?: string; firm_id?: string } | undefined;
  const clientName = clientRow?.name ?? null;
  const clientOrgName = clientRow?.firm_id
    ? (organisations.find((o) => o.id === clientRow.firm_id)?.name ?? null)
    : null;
  // Card menu items follow the one rule (client_visible_cards), fetched fresh.
  const fetchVisibleCards = useServerFn(getMyClientVisibleCards);
  const visibleCardsQ = useQuery({
    queryKey: ["client-visible-cards", clientId],
    queryFn: () => fetchVisibleCards({ data: { clientId: clientId! } }),
    enabled: !!clientId,
    retry: false,
    staleTime: 0,
  });
  const clientVisibleCards = visibleCardsQ.data?.cards ?? null;
  // Loans / Consolidations follow the owner-or-team rule, fetched from the server.
  const fetchLoansAccess = useServerFn(getMyLoansAccess);
  const loansFirmId = workspace.kind === "organisation" ? (workspace as any).firmId as string | undefined : undefined;
  const loansQ = useQuery({
    queryKey: ["loans-access", clientId ?? null, loansFirmId ?? null],
    queryFn: () => fetchLoansAccess({ data: { ...(clientId ? { clientId } : {}), ...(loansFirmId ? { firmId: loansFirmId } : {}) } }),
    enabled: !!clientId || !!loansFirmId,
    retry: false,
  });
  // Practice-only upsell entry; the database returns nothing to anyone else.
  const fetchLocked = useServerFn(getMyLockedModules);
  const lockedQ = useQuery({
    queryKey: ["client-locked-modules", clientId],
    queryFn: () => fetchLocked({ data: { clientId: clientId! } }),
    enabled: !!clientId,
    retry: false,
  });
  const groups = navForWorkspace(workspace, {
    lockedModules: lockedQ.data?.modules ?? [],
    canSeeSystem, clientFiles, organisations, clientVisibleCards,
    canOpenLoans: loansQ.data?.clientLoans === true,
    canOpenConsolidations: loansQ.data?.consolidations === true,
  }).map((group) => ({
    ...group,
    items: workspace.kind === "client" && manageQ.data?.canManageClient !== true
      ? group.items.filter((item) => !["cashflow", "loans", "client-settings"].includes(item.id))
      : group.items,
  }));

  // Back links are presentation only: they appear only when the caller-scoped
  // organisation list already includes the destination; each page keeps its own guard.
  const backLink: { label: string; to: string; params: Record<string, string> } | null =
    workspace.kind === "client" && clientRow?.firm_id && clientOrgName
      ? { label: `Back to ${clientOrgName}`, to: "/firms/$firmId", params: { firmId: clientRow.firm_id } }
      : workspace.kind === "organisation" && organisations.length > 1
        ? { label: "All organisations", to: "/overview", params: {} }
        : null;

  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  const renderLink = (item: NavItem, label: string) => (
    <Link to={item.to as any} params={params as any} onClick={onNavigate}>
      {(() => {
        const Icon = ICONS[item.icon];
        return <Icon className="h-4 w-4" />;
      })()}
      <span>{label}</span>
    </Link>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2 overflow-hidden">
        <img src={taMonogram} alt="Traction Advisory TA" className="hidden h-8 w-8 shrink-0 object-contain group-data-[collapsible=icon]:block" />
        <WorkspaceSwitcher
          workspace={workspace}
          canSeeSystem={canSeeSystem}
          organisations={organisations}
          clientName={clientName}
          clientOrgName={clientOrgName}
        />
      </SidebarHeader>

      <SidebarContent>
        {backLink && (
          <SidebarGroup className="pb-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={backLink.label}>
                  <Link to={backLink.to as any} params={backLink.params as any} onClick={onNavigate} className="h-auto rounded-full border border-sidebar-border bg-tint-panel px-3 py-1.5 text-xs text-emphasis">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="truncate">{backLink.label.startsWith("Back to ") ? <><strong>Back to</strong> {backLink.label.slice(8)}</> : <strong>{backLink.label}</strong>}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            {group.id !== "practice" && group.id !== "client" && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-2.5">
                {group.items.map((item) => {
                  const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
                  if (item.children?.length) {
                    const branchActive = isBranchActive(item, pathname, params);
                    const Icon = ICONS[item.icon];
                    return (
                      <Collapsible key={`${item.id}-${branchActive}`} defaultOpen={branchActive} asChild className="group/collapsible">
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.label} isActive={branchActive} className="h-auto min-h-9 rounded-lg border border-sidebar-border bg-card py-2 text-sidebar-foreground data-[active=true]:border-sidebar-accent">
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                              <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.id}>
                                  <SidebarMenuSubButton asChild isActive={isItemActive(child, pathname, params)} className="rounded-lg border border-sidebar-border bg-card data-[active=true]:border-sidebar-accent">
                                    <Link to={child.to as any} params={params as any} onClick={onNavigate}>
                                      <span>{child.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton asChild isActive={isItemActive(item, pathname, params)} tooltip={item.label} className="h-auto min-h-9 rounded-lg border border-sidebar-border bg-card py-2 text-sidebar-foreground data-[active=true]:border-sidebar-accent">
                        {renderLink(item, item.label)}
                      </SidebarMenuButton>
                      {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        {canSeeSystem && workspace.kind === "system" && (
          <SidebarGroup>
            <SecurityStatusCard />
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu className="gap-2.5">
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="My account" isActive={pathname.startsWith("/settings/account")} className="h-auto min-h-9 rounded-lg border border-sidebar-border bg-card py-2 text-sidebar-foreground data-[active=true]:border-sidebar-accent">
              <Link to="/settings/account" onClick={onNavigate}>
                <UserCircle className="h-4 w-4" />
                <span>My account</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => void signOut()} tooltip="Sign out" data-sign-out className="h-auto min-h-9 rounded-lg border border-sidebar-border bg-card py-2 text-sidebar-foreground data-[active=true]:border-sidebar-accent">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
