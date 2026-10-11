// Trixie's page map. Built from the real sidebar menus (sidebar-nav.ts) plus
// the few account pages outside them, so Trixie can point people to the right
// page with a working in-app link. Presentation only: every page keeps its own
// server guards, and a page appearing here never grants access to it.

import { CLIENT_NAV, ORGANISATION_NAV, SYSTEM_NAV, fillPath, type NavGroup, type NavItem } from "@/lib/nav/sidebar-nav";

export type TrixiePageAudience = "platform" | "staff" | "viewer";
export type TrixiePage = { label: string; path: string; area: string };
export type TrixiePageScope = {
  mode: "platform" | "organisation" | "client" | "general";
  audience: TrixiePageAudience;
  firmId: string | null;
  clientId: string | null;
};

/** Client pages a business owner or external adviser can open. */
const VIEWER_CLIENT_ITEMS = new Set(["dashboard", "reports"]);

const ACCOUNT_PAGES: Array<{ label: string; to: string }> = [
  { label: "Account settings", to: "/settings/account" },
  { label: "Sign-in activity", to: "/settings/activity" },
];

const EXTRA_STAFF_PAGES: Array<{ label: string; to: string; area: string }> = [
  { label: "All organisations overview", to: "/overview", area: "All organisations" },
];

function flatten(groups: NavGroup[], keep: (item: NavItem) => boolean = () => true) {
  const out: Array<{ label: string; to: string; area: string }> = [];
  const walk = (items: NavItem[], area: string, prefix: string) => {
    for (const item of items) {
      if (!keep(item)) continue;
      const label = prefix ? `${prefix} → ${item.label}` : item.label;
      if (item.children?.length) walk(item.children, area, item.label);
      else out.push({ label, to: item.to, area });
    }
  };
  for (const group of groups) walk(group.items, group.label, "");
  return out;
}

/** Every route pattern Trixie is allowed to link to. */
export function trixieRoutePatterns(): string[] {
  return Array.from(
    new Set([
      ...flatten(SYSTEM_NAV).map((p) => p.to),
      ...flatten(ORGANISATION_NAV).map((p) => p.to),
      ...flatten(CLIENT_NAV).map((p) => p.to),
      ...ACCOUNT_PAGES.map((p) => p.to),
      ...EXTRA_STAFF_PAGES.map((p) => p.to),
    ]),
  );
}

/** The pages this caller can use from where they are, with real IDs filled in. */
export function trixiePageMap(scope: TrixiePageScope): TrixiePage[] {
  const pages: TrixiePage[] = [];
  const add = (list: Array<{ label: string; to: string; area: string }>, params: Record<string, string>) => {
    for (const p of list) {
      if (/\$[a-zA-Z]+/.test(p.to) && !Object.keys(params).some((k) => p.to.includes(`$${k}`))) continue;
      pages.push({ label: p.label, path: fillPath(p.to, params), area: p.area });
    }
  };
  if (scope.mode === "platform") {
    add(flatten(SYSTEM_NAV).map((p) => ({ ...p, area: `System Admin → ${p.area}` })), {});
  } else if (scope.audience === "viewer") {
    if (scope.clientId) add(flatten(CLIENT_NAV, (i) => VIEWER_CLIENT_ITEMS.has(i.id)), { clientId: scope.clientId });
  } else {
    if (scope.firmId) add(flatten(ORGANISATION_NAV), { firmId: scope.firmId });
    if (scope.clientId) add(flatten(CLIENT_NAV), { clientId: scope.clientId });
    add(EXTRA_STAFF_PAGES, {});
  }
  add(ACCOUNT_PAGES.map((p) => ({ ...p, area: "Your account" })), {});
  // Unfilled patterns never reach the model.
  return pages.filter((p) => !p.path.includes("$"));
}

const ID = "[0-9a-fA-F-]{36}";
const patternRegexes = () =>
  trixieRoutePatterns().map(
    (pattern) => new RegExp(`^${pattern.replace(/\$firmId|\$clientId/g, ID).replace(/\//g, "\\/")}$`),
  );

/** True only for an in-app path that matches a real page Trixie may link to. */
export function isKnownAppPath(href: string): boolean {
  if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) return false;
  const path = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return patternRegexes().some((re) => re.test(path));
}

export function pageMapText(pages: TrixiePage[]): string {
  return pages.map((p) => `- ${p.area}: [${p.label}](${p.path})`).join("\n");
}
