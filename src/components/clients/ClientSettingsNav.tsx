import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const ITEMS = [
  ["general", "General"], ["cards", "Cards & report branding"], ["people", "People"],
  ["xero", "Xero connections"], ["tax-reporting", "Tax & reporting"],
  ["costs", "Cost & cash commitments"], ["danger", "Danger zone"],
] as const;

export function ClientSettingsNav({ clientId }: { clientId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return <nav aria-label="Client settings" className="border-b border-border px-6"><div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto py-2">{ITEMS.map(([slug,label]) => <Link key={slug} to={`/clients/$clientId/settings/${slug}` as never} params={{clientId} as never} className={cn("whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", pathname.endsWith(`/${slug}`) && "bg-muted text-foreground")}>{label}</Link>)}</div></nav>;
}
