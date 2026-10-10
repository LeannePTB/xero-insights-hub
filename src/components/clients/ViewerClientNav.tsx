import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function ViewerClientNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const match = /^\/clients\/([^/]+)/.exec(pathname);
  const clientId = match?.[1];
  if (!clientId || clientId === "new") return null;
  const links = [
    { label: "Live Dashboard", to: "/clients/$clientId", icon: BarChart3, active: pathname === `/clients/${clientId}` || pathname === `/clients/${clientId}/` },
    { label: "Monthly reports", to: "/clients/$clientId/reports", icon: FileText, active: pathname.startsWith(`/clients/${clientId}/reports`) },
  ] as const;
  return <header className="border-b border-border bg-card"><nav aria-label="Client" className="mx-auto flex max-w-7xl gap-1 px-4 py-2">{links.map((item) => <Link key={item.label} to={item.to} params={{ clientId }} className={cn("inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground", item.active && "bg-muted text-foreground")}><item.icon className="h-4 w-4" />{item.label}</Link>)}</nav></header>;
}