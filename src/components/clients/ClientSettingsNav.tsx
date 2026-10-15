import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { getClientWidgets } from "@/lib/clients.functions";

const ITEMS = [
  ["general", "General"], ["cards", "Cards & report branding"], ["people", "People"],
  ["xero", "Xero connections"], ["tax-reporting", "Tax & reporting"], ["banks", "Banks & accounts"],
  ["cost-classification", "Cost classification"], ["costs", "Cost & cash commitments"], ["danger", "Danger zone"],
] as const;

export function ClientSettingsNav({ clientId }: { clientId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // "Cost & cash commitments" only exists to feed the Break-Even card, so the
  // tab is hidden unless that card is part of the client's package.
  const fetchWidgets = useServerFn(getClientWidgets);
  const widgetsQ = useQuery({
    queryKey: ["client-widgets", clientId, "settings-nav"],
    queryFn: () => fetchWidgets({ data: { clientId } }),
  });
  const allowed = new Set((widgetsQ.data?.widgets ?? []) as string[]);
  const items = ITEMS.filter(([slug]) => slug !== "costs" || allowed.has("true_breakeven"));
  return <nav aria-label="Client settings" className="border-b border-border px-6"><div className="mx-auto flex max-w-4xl flex-wrap gap-1 py-2">{items.map(([slug,label]) => <Link key={slug} to={`/clients/$clientId/settings/${slug}` as never} params={{clientId} as never} className={cn("whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", pathname.endsWith(`/${slug}`) && "bg-muted text-foreground")}>{label}</Link>)}</div></nav>;
}
