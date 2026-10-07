import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/components/BrandMark";
import { SecurityStatusCard } from "@/components/admin/SecurityStatusCard";
import { Building2, LayoutGrid, Shield, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/roles.functions";

const baseItems = [
  { title: "Organisations", url: "/admin", icon: Building2 },
  { title: "Security & Compliance", url: "/admin/security", icon: Shield },
  { title: "Advisors", url: "/settings/advisors", icon: Users },
];


export function AdminSidebar() {
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
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1">
          <BrandMark logoHeightClass="h-6" />
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
    </Sidebar>
  );
}
