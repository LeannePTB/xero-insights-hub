import { useNavigate } from "@tanstack/react-router";
import { Briefcase, Building2, ChevronsUpDown, LayoutGrid, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { Workspace } from "@/lib/nav/sidebar-nav";

type Props = {
  workspace: Workspace;
  canSeeSystem: boolean;
  organisations: { id: string; name: string }[];
  clientName?: string | null;
  clientOrgName?: string | null;
};

/** Moves you to another address; the address decides the menu. Grants nothing. */
export function WorkspaceSwitcher({ workspace, canSeeSystem, organisations, clientName, clientOrgName }: Props) {
  const navigate = useNavigate();
  const current =
    workspace.kind === "system"
      ? "System Admin"
      : workspace.kind === "all"
        ? "All organisations"
        : workspace.kind === "organisation"
          ? (organisations.find((o) => o.id === workspace.firmId)?.name ?? "Organisation")
          : workspace.kind === "client"
            ? (clientName ?? "Client")
            : "Choose workspace";
  const Icon =
    workspace.kind === "system" ? ShieldCheck : workspace.kind === "all" ? LayoutGrid : workspace.kind === "client" ? Briefcase : Building2;

  if (!canSeeSystem && organisations.length === 0) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={current} className="border border-border/60">
              <Icon className="h-4 w-4" />
              <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                <span className="truncate text-sm font-semibold">{current}</span>
                {workspace.kind === "client" && clientOrgName && (
                  <span className="truncate text-xs text-muted-foreground">{clientOrgName}</span>
                )}
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {canSeeSystem && (
              <>
                <DropdownMenuItem onSelect={() => navigate({ to: "/system" })}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> System Admin
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel>Organisations</DropdownMenuLabel>
            {organisations.length > 1 && (
              <DropdownMenuItem onSelect={() => navigate({ to: "/overview" })}>
                <LayoutGrid className="mr-2 h-4 w-4" /> All organisations
              </DropdownMenuItem>
            )}
            {organisations.map((o) => (
              <DropdownMenuItem
                key={o.id}
                onSelect={() => navigate({ to: "/firms/$firmId", params: { firmId: o.id } })}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <span className="truncate">{o.name}</span>
              </DropdownMenuItem>
            ))}
            {organisations.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No organisations</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
