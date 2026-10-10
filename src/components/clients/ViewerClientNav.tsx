import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceBranding } from "@/hooks/useWorkspaceBranding";
import { DEFAULT_BRANDING } from "@/hooks/usePlatformBranding";


export function ViewerClientNav() {
  const brand = useWorkspaceBranding();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const match = /^\/clients\/([^/]+)/.exec(pathname);
  const clientId = match?.[1];
  if (!clientId || clientId === "new") return null;
  const links = [
    { label: "Live Dashboard", to: "/clients/$clientId", icon: BarChart3, active: pathname === `/clients/${clientId}` || pathname === `/clients/${clientId}/` },
    { label: "Monthly reports", to: "/clients/$clientId/reports", icon: FileText, active: pathname.startsWith(`/clients/${clientId}/reports`) },
  ] as const;
  return <header className="border-b border-border bg-card"><div className="flex min-h-14 max-w-7xl flex-wrap items-center gap-4 px-4 py-2 sm:px-6"><div className="flex min-w-0 items-center gap-2">{brand.logoLight !== DEFAULT_BRANDING.logoLight ? <img src={brand.logoLight} alt={brand.productName} className="h-9 w-auto max-w-36 object-contain" /> : <span className="truncate text-lg font-semibold tracking-tight">{brand.productName}</span>}</div><nav aria-label="Client" className="flex gap-1">{links.map((item) => <Link key={item.label} to={item.to} params={{ clientId }} className={cn("inline-flex min-h-8 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground", item.active && "bg-primary text-primary-foreground")}><item.icon className="h-4 w-4" />{item.label}</Link>)}</nav></div></header>;
}