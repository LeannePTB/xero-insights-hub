/**
 * Menu definitions for the three navigation layers.
 *
 * Presentation only. Items are plain data (no React, no functions) so the
 * definition could later be loaded from the database. Hiding an item grants
 * or removes nothing: every route keeps its own server-side guard.
 */

export type NavIcon =
  | "building"
  | "layers"
  | "users"
  | "palette"
  | "shield"
  | "activity"
  | "grid"
  | "briefcase"
  | "link"
  | "settings"
  | "chart"
  | "file"
  | "trending"
  | "landmark"
  | "message";

export type NavItem = {
  id: string;
  label: string;
  icon: NavIcon;
  /** Route path pattern, e.g. "/firms/$firmId/people". */
  to: string;
  /** Exact match only (otherwise prefix match). */
  exact?: boolean;
  children?: NavItem[];
  /** Key into the optional badge counts map. */
  badgeKey?: string;
};

export type NavGroup = { id: string; label: string; items: NavItem[] };

export type Workspace =
  | { kind: "system" }
  | { kind: "organisation"; firmId: string }
  | { kind: "client"; clientId: string }
  | { kind: "none" };

export const SYSTEM_NAV: NavGroup[] = [
  {
    id: "platform",
    label: "Platform",
    items: [
      { id: "orgs", label: "Organisations", icon: "building", to: "/system", exact: true },
      { id: "staff", label: "Platform staff", icon: "users", to: "/system/staff" },
      { id: "branding", label: "Platform branding", icon: "palette", to: "/system/branding" },
      { id: "trixie", label: "Trixie", icon: "message", to: "/system/trixie" },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    items: [
      { id: "security", label: "Security & Compliance", icon: "shield", to: "/system/security" },
      { id: "xero", label: "Xero monitoring", icon: "activity", to: "/system/xero" },
    ],
  },
];

export const ORGANISATION_NAV: NavGroup[] = [
  {
    id: "practice",
    label: "Practice",
    items: [
      { id: "overview", label: "Overview", icon: "activity", to: "/firms/$firmId/overview" },
      { id: "clients", label: "Clients", icon: "briefcase", to: "/firms/$firmId", exact: true },
      { id: "xero-files", label: "Xero files", icon: "link", to: "/firms/$firmId/xero-files" },
      {
        id: "consolidations",
        label: "Consolidations",
        icon: "layers",
        to: "/firms/$firmId/consolidations",
        children: [
          { id: "groups", label: "Groups", icon: "layers", to: "/firms/$firmId/consolidations" },
          { id: "loan-matrix", label: "Loan matrix", icon: "link", to: "/firms/$firmId/loans", exact: true },
          { id: "loan-groups", label: "Loan groups", icon: "layers", to: "/firms/$firmId/loans/groups" },
          { id: "loan-accounts", label: "Loan accounts", icon: "landmark", to: "/firms/$firmId/loans/accounts" },
        ],
      },
      { id: "people", label: "People & access", icon: "users", to: "/firms/$firmId/people" },
      {
        id: "settings",
        label: "Settings",
        icon: "settings",
        to: "/firms/$firmId/settings",
        children: [
          { id: "s-general", label: "General", icon: "settings", to: "/firms/$firmId/settings/general" },
          { id: "s-cards", label: "Card defaults", icon: "grid", to: "/firms/$firmId/settings/cards" },
          { id: "s-subscription", label: "Subscription", icon: "file", to: "/firms/$firmId/settings/subscription" },
          { id: "s-ownership", label: "Ownership", icon: "users", to: "/firms/$firmId/settings/ownership" },
          { id: "s-support", label: "Support access", icon: "shield", to: "/firms/$firmId/settings/support" },
        ],
      },
    ],
  },
];

export const CLIENT_NAV: NavGroup[] = [
  {
    id: "client",
    label: "Client",
    items: [
      { id: "dashboard", label: "Live Dashboard", icon: "chart", to: "/clients/$clientId", exact: true },
      { id: "reports", label: "Monthly reports", icon: "file", to: "/clients/$clientId/reports" },
      { id: "cashflow", label: "Cash flow scenario", icon: "trending", to: "/clients/$clientId/cashflow-scenario" },
      {
        id: "loans", label: "Loans", icon: "landmark", to: "/clients/$clientId/loans",
        children: [
          { id: "loan-matrix", label: "Loan matrix", icon: "landmark", to: "/clients/$clientId/loans", exact: true },
          { id: "loan-accounts", label: "Loan accounts", icon: "settings", to: "/clients/$clientId/loans-accounts" },
        ],
      },
      {
        id: "client-settings", label: "Client settings", icon: "settings", to: "/clients/$clientId/settings",
        children: [
          { id: "client-general", label: "General", icon: "settings", to: "/clients/$clientId/settings/general" },
          { id: "client-cards", label: "Cards & report branding", icon: "grid", to: "/clients/$clientId/settings/cards" },
          { id: "client-people", label: "People", icon: "users", to: "/clients/$clientId/settings/people" },
          { id: "client-xero", label: "Xero connections", icon: "link", to: "/clients/$clientId/settings/xero" },
          { id: "client-tax", label: "Tax & reporting", icon: "file", to: "/clients/$clientId/settings/tax-reporting" },
          { id: "client-costs", label: "Cost & cash commitments", icon: "trending", to: "/clients/$clientId/settings/costs" },
          { id: "client-danger", label: "Danger zone", icon: "shield", to: "/clients/$clientId/settings/danger" },
        ],
      },
    ],
  },
];

export type ClientXeroFile = { tenantId: string; name: string };

/**
 * Payables / Receivables need a Xero file: one file links straight through,
 * several become sub-items, none hides the items. Pages keep their own guards.
 */
export function clientFileItems(files: ClientXeroFile[]): NavItem[] {
  if (files.length === 0) return [];
  const make = (kind: "payables" | "receivables" | "audit", label: string, icon: NavIcon): NavItem =>
    files.length === 1
      ? { id: kind, label, icon, to: `/clients/$clientId/${kind}/${files[0].tenantId}` }
      : {
          id: kind,
          label,
          icon,
          // Multi-file parents are disclosure controls only; use the first
          // authorised file as a valid fallback destination.
          to: `/clients/$clientId/${kind}/${files[0].tenantId}`,
          children: files.map((f) => ({ id: `${kind}-${f.tenantId}`, label: f.name, icon, to: `/clients/$clientId/${kind}/${f.tenantId}` })),
        };
  return [{
    id: "xero-files", label: "Xero files", icon: "link", to: `/clients/$clientId/audit/${files[0].tenantId}`,
    children: [make("payables", "Payables", "file"), make("receivables", "Receivables", "file"), make("audit", "Xero audit", "activity")],
  }];
}

export function clientNav(files: ClientXeroFile[]): NavGroup[] {
  return [{ ...CLIENT_NAV[0], items: [...CLIENT_NAV[0].items, ...clientFileItems(files)] }];
}

/** Which workspace the current address belongs to. */
export function workspaceFromPath(pathname: string): Workspace {
  if (pathname === "/system" || pathname.startsWith("/system/")) return { kind: "system" };
  const firm = /^\/firms\/([^/]+)/.exec(pathname);
  if (firm) return { kind: "organisation", firmId: firm[1] };
  const client = /^\/clients\/([^/]+)/.exec(pathname);
  if (client && client[1] !== "new") return { kind: "client", clientId: client[1] };
  return { kind: "none" };
}

export function fillPath(pattern: string, params: Record<string, string>): string {
  return pattern.replace(/\$(\w+)/g, (_, k) => params[k] ?? "");
}

export function isItemActive(item: NavItem, pathname: string, params: Record<string, string>): boolean {
  const target = fillPath(item.to, params).replace(/\/$/, "") || "/";
  const path = pathname.replace(/\/$/, "") || "/";
  if (item.exact) return path === target;
  return path === target || path.startsWith(target + "/");
}

export function isBranchActive(item: NavItem, pathname: string, params: Record<string, string>): boolean {
  if (isItemActive(item, pathname, params)) return true;
  return (item.children ?? []).some((c) => isBranchActive(c, pathname, params));
}

/**
 * Pick the menu for a workspace. `canSeeSystem` must come from the server
 * signal (getMyContext.isSuperAdmin) — never from browser storage.
 */
export function navForWorkspace(ws: Workspace, opts: { canSeeSystem: boolean; clientFiles?: ClientXeroFile[] }): NavGroup[] {
  if (ws.kind === "system") return opts.canSeeSystem ? SYSTEM_NAV : [];
  if (ws.kind === "organisation") return ORGANISATION_NAV;
  if (ws.kind === "client") return clientNav(opts.clientFiles ?? []);
  return [];
}

