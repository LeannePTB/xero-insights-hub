import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Same names and order as the Client settings entries in the side menu. */
export const CLIENT_SETTINGS_TABS = [
  ["general", "General"], ["cards", "Cards & report branding"], ["people", "People"],
  ["xero", "Xero connections"], ["tax-reporting", "Tax & reporting"], ["account-setup", "Account setup"],
  ["danger", "Danger zone"],
] as const;

/** Which tab owns each section anchor; old General#anchor links redirect here. */
export const TAB_BY_ANCHOR: Record<string, string> = {
  "xero-organisations": "xero",
  "lodgement-cycles": "tax-reporting",
  "report-basis": "tax-reporting",
  "gst-method": "tax-reporting",
  "income-tax-instalments": "tax-reporting",
  "statutory-accounts": "account-setup",
  "cost-classification": "account-setup",
  "bank-accounts": "account-setup",
  "account-setup-cost": "account-setup",
  "account-setup-tax": "account-setup",
  "account-setup-bank": "account-setup",
  cards: "cards",
};

export function ClientSettingsNav({ clientId }: { clientId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return <nav aria-label="Client settings" className="border-b border-border px-4 sm:px-3"><div className="flex max-w-4xl flex-wrap gap-1 py-2">{CLIENT_SETTINGS_TABS.map(([slug,label]) => <Link key={slug} to={`/clients/$clientId/settings/${slug}` as never} params={{clientId} as never} className={cn("whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", pathname.endsWith(`/${slug}`) && "bg-muted text-foreground")}>{label}</Link>)}</div></nav>;
}
