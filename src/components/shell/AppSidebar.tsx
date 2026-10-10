import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  ChevronRight,
  FileText,
  LayoutGrid,
  Landmark,
  Layers,
  Link2,
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
import { useSignOut } from "@/lib/use-sign-out";
import { useWorkspaceBranding } from "@/hooks/useWorkspaceBranding";
import {
  isBranchActive,
  isItemActive,
  navForWorkspace,
  workspaceFromPath,
  type NavIcon,
  type NavItem,
  type Workspace,
} from "@/lib/nav/sidebar-nav";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

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
};

export function AppSidebar({ badges = {} }: { badges?: Record<string, number> }) {
  const signOut = useSignOut();
  const brand = useWorkspaceBranding();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Visibility comes only from server signals.
  const fetchCtx = useServerFn(getMyContext);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const fetchFirms = useServerFn(listMyFirms);
  const firmsQ = useQuery({ queryKey: ["nav-my-firms"], queryFn: () => fetchFirms(), staleTime: 5 * 60_000 });
  const canSeeSystem = ctxQ.data?.isSuperAdmin === true;
  const organisations = firmsQ.data?.firms ?? [];

  let workspace: Workspace = workspaceFromPath(pathname);
  if (workspace.kind === "none") {
    if (organisations[0]) workspace = { kind: "organisation", firmId: organisations[0].id };
    else if (canSeeSystem) workspace = { kind: "system" };
  }
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
  const groups = navForWorkspace(workspace, { canSeeSystem, clientFiles }).map((group) => ({
    ...group,
    items: workspace.kind === "client" && manageQ.data?.canManageClient !== true
      ? group.items.filter((item) => !["cashflow", "loans", "client-settings"].includes(item.id))
      : group.items,
  }));

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
        <Link
          to="/"
          aria-label={brand.productName}
          className="flex h-11 min-w-0 items-center px-2 group-data-[collapsible=icon]:px-0"
        >
          <span className="block h-9 max-w-full overflow-hidden group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:shrink-0">
            <img src={brand.logoLight} alt={brand.productName} className="h-9 w-auto max-w-full object-contain group-data-[collapsible=icon]:w-[72px] group-data-[collapsible=icon]:max-w-none group-data-[collapsible=icon]:object-cover group-data-[collapsible=icon]:object-left" />
          </span>
        </Link>
        <WorkspaceSwitcher workspace={workspace} canSeeSystem={canSeeSystem} organisations={organisations} />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
                  if (item.children?.length) {
                    const branchActive = isBranchActive(item, pathname, params);
                    const Icon = ICONS[item.icon];
                    return (
                      <Collapsible key={`${item.id}-${branchActive}`} defaultOpen={branchActive} asChild className="group/collapsible">
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.label} isActive={branchActive}>
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                              <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.id}>
                                  <SidebarMenuSubButton asChild isActive={isItemActive(child, pathname, params)}>
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
                      <SidebarMenuButton asChild isActive={isItemActive(item, pathname, params)} tooltip={item.label}>
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="My account" isActive={pathname.startsWith("/settings/account")}>
              <Link to="/settings/account" onClick={onNavigate}>
                <UserCircle className="h-4 w-4" />
                <span>My account</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => void signOut()} tooltip="Sign out" data-sign-out>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
