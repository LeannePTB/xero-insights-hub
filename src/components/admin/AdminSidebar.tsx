import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import ptLogo from "@/assets/traction-advisory-logo.png";
import { SecurityStatusCard } from "@/components/admin/SecurityStatusCard";
import { Building2, LayoutGrid, LogOut, Shield, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/roles.functions";
import { useSignOut } from "@/lib/use-sign-out";

const baseItems = [
  { title: "Organisations", url: "/admin", icon: Building2 },
  { title: "Security & Compliance", url: "/admin/security", icon: Shield },
  { title: "Advisors", url: "/settings/advisors", icon: Users },
];


export function AdminSidebar() {
  const signOut = useSignOut();
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });
  const fetchCtx = useServerFn(getMyContext);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  // Link only; the overview's server function decides what is shown.
  const items = [
    ...(ctxQ.data?.isPracticeMember ? [{ title: "Overview", url: "/overview", icon: LayoutGrid }] : []),
    ...(ctxQ.data?.isSuperAdmin ? baseItems : []),
  ];

  const isActive = (path: string) => {
    if (path === "/admin") return currentPath === "/admin";
    return currentPath.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="overflow-hidden">
        <Link to="/dashboard" aria-label="Traction Advisory" className="flex h-8 min-w-0 items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <img src={ptLogo} alt="Traction Advisory" className="h-6 w-auto max-w-full shrink-0 object-contain group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-8" />
          <span className="min-w-0 text-[10px] font-semibold uppercase text-accent group-data-[collapsible=icon]:hidden">
            Traction Advisory
            <span className="block">Dashboards</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{ctxQ.data?.isSuperAdmin ? "Administration" : "Practice"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
        </SidebarGroupContent>
        </SidebarGroup>
        {ctxQ.data?.isSuperAdmin && (
          <SidebarGroup>
            <SecurityStatusCard />
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => void signOut()}
              tooltip="Sign out"
              data-sign-out
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
