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
  | "message"
  | "lock";

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
  /**
   * Catalogue card this item opens. Shown only when the server-provided
   * visible-card list (client_visible_cards) includes it.
   */
  cardKey?: string;
};

export type NavGroup = { id: string; label: string; items: NavItem[] };

export type Workspace =
  | { kind: "system" }
  | { kind: "all" }
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
      { id: "packages", label: "Packages & modules", icon: "grid", to: "/system/packages" },
      { id: "enquiries", label: "Enquiries", icon: "message", to: "/system/enquiries" },
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
    label: "Organisation",
    items: [
      { id: "overview", label: "Overview", icon: "activity", to: "/firms/$firmId", exact: true },
      { id: "add-client", label: "Add client", icon: "briefcase", to: "/firms/$firmId/add-client" },
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
          { id: "s-cards", label: "Default modules", icon: "grid", to: "/firms/$firmId/settings/cards" },
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
      {
        id: "loans", label: "Loans", icon: "landmark", to: "/clients/$clientId/loans", cardKey: "loan_consolidation",
        children: [
          { id: "loan-matrix", label: "Loan matrix", icon: "landmark", to: "/clients/$clientId/loans", exact: true, cardKey: "loan_consolidation" },
          { id: "loan-accounts", label: "Loan accounts", icon: "settings", to: "/clients/$clientId/loans-accounts", cardKey: "loan_consolidation" },
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
          { id: "client-account-setup", label: "Account setup", icon: "trending", to: "/clients/$clientId/settings/account-setup" },
          { id: "client-danger", label: "Danger zone", icon: "shield", to: "/clients/$clientId/settings/danger" },
        ],
      },
    ],
  },
];

/** One locked entry point; shown only when the server lists locked modules. */
export const ADVISORY_LOCKED_ITEM: NavItem = { id: "advisory-locked", label: "Advisory", icon: "lock", to: "/clients/$clientId/advisory" };

export type ClientXeroFile = { tenantId: string; name: string };

/**
 * Payables / Receivables need a Xero file: one file links straight through,
 * several become sub-items, none hides the items. Pages keep their own guards.
 */
export function clientFileItems(files: ClientXeroFile[]): NavItem[] {
  if (files.length === 0) return [];
  const CARD = { payables: "payables", receivables: "receivables", audit: "xero_audit" } as const;
  const make = (kind: "payables" | "receivables" | "audit", label: string, icon: NavIcon): NavItem =>
    files.length === 1
      ? { id: kind, label, icon, to: `/clients/$clientId/${kind}/${files[0].tenantId}`, cardKey: CARD[kind] }
      : {
          id: kind,
          label,
          icon,
          cardKey: CARD[kind],
          // Multi-file parents are disclosure controls only; use the first
          // authorised file as a valid fallback destination.
          to: `/clients/$clientId/${kind}/${files[0].tenantId}`,
          children: files.map((f) => ({ id: `${kind}-${f.tenantId}`, label: f.name, icon, to: `/clients/$clientId/${kind}/${f.tenantId}`, cardKey: CARD[kind] })),
        };
  return [{
    // The Xero file audit is retired (Bookkeeping checks); its page stays in code, unlinked.
    id: "xero-files", label: "Xero files", icon: "link", to: `/clients/$clientId/payables/${files[0].tenantId}`,
    children: [make("payables", "Payables", "file"), make("receivables", "Receivables", "file")],
  }];
}

export function clientNav(files: ClientXeroFile[], visibleCards: readonly string[] | null = null): NavGroup[] {
  const groups = [{ ...CLIENT_NAV[0], items: [...CLIENT_NAV[0].items, ...clientFileItems(files)] }];
  return filterByVisibleCards(groups, visibleCards);
}

/**
 * Drops every item whose card is not in the server-provided visible list.
 * `null` (unknown, loading or failed) hides every card item — fail closed.
 * A parent left with no children after filtering is dropped too, so a
 * "Xero files" group never opens onto a card the client cannot see.
 * Not a rule: it only mirrors client_visible_cards; pages re-check on the server.
 */
export function filterByVisibleCards(groups: NavGroup[], visibleCards: readonly string[] | null): NavGroup[] {
  const visible = new Set(visibleCards ?? []);
  const keep = (item: NavItem): NavItem | null => {
    if (item.cardKey && !visible.has(item.cardKey)) return null;
    if (!item.children) return item;
    const children = item.children.map(keep).filter((c): c is NavItem => c !== null);
    if (children.length === 0) return null;
    const first = children[0]!;
    // Parent link falls back to the first child still visible.
    const to = item.cardKey || children.some((c) => c.to === item.to) ? item.to : first.to;
    return { ...item, to, children };
  };
  return groups.map((g) => ({ ...g, items: g.items.map(keep).filter((i): i is NavItem => i !== null) }));
}

/**
 * Which workspace the current address belongs to. Every address maps to
 * exactly one answer; "none" means the page is workspace-neutral (account
 * pages) and the caller keeps the previous menu. Never guesses an organisation.
 */
export function workspaceFromPath(pathname: string): Workspace {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/system" || path.startsWith("/system/")) return { kind: "system" };
  if (path === "/overview") return { kind: "all" };
  const firm = /^\/firms\/([^/]+)/.exec(path);
  if (firm) return { kind: "organisation", firmId: firm[1] };
  const client = /^\/clients\/([^/]+)/.exec(path);
  if (client && client[1] !== "new") return { kind: "client", clientId: client[1] };
  return { kind: "none" };
}

/** Account pages keep whichever menu the person was last using. */
export function isWorkspaceNeutralPath(pathname: string): boolean {
  return workspaceFromPath(pathname).kind === "none";
}

/**
 * The menu to show for an address: the address decides, except on
 * workspace-neutral pages, which keep the previous workspace.
 */
export function resolveWorkspace(pathname: string, previous: Workspace): Workspace {
  const ws = workspaceFromPath(pathname);
  return ws.kind === "none" ? previous : ws;
}

export type OrganisationSummary = { id: string; name: string; clientCount?: number };

/** Cross-organisation menu for /overview. Links use concrete paths. */
export function allOrganisationsNav(organisations: OrganisationSummary[]): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: "all",
      label: "All organisations",
      items: [{ id: "all-overview", label: "All organisations", icon: "grid", to: "/overview", exact: true }],
    },
  ];
  if (organisations.length > 0) {
    groups.push({
      id: "your-organisations",
      label: "Your organisations",
      items: organisations.map((o) => ({
        id: `org-${o.id}`,
        label: o.name,
        icon: "building",
        to: o.clientCount === 0 ? `/firms/${o.id}` : `/firms/${o.id}/overview`,
      })),
    });
  }
  return groups;
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
export function navForWorkspace(
  ws: Workspace,
  opts: {
    canSeeSystem: boolean;
    clientFiles?: ClientXeroFile[];
    organisations?: OrganisationSummary[];
    /** Server-provided client_visible_cards list; null hides card items. */
    clientVisibleCards?: readonly string[] | null;
    /** Server signal public.me_can_open_client_loans; absent/false hides Loans. */
    canOpenLoans?: boolean;
    /** Server signal public.me_can_open_consolidations; absent/false hides Consolidations. */
    canOpenConsolidations?: boolean;
    /** Server signal public.client_locked_modules; empty/absent hides the locked Advisory item. */
    lockedModules?: readonly string[];
  },
): NavGroup[] {
  if (ws.kind === "system") return opts.canSeeSystem ? SYSTEM_NAV : [];
  if (ws.kind === "all") return allOrganisationsNav(opts.organisations ?? []);
  if (ws.kind === "organisation") return dropItems(ORGANISATION_NAV, opts.canOpenConsolidations === true ? [] : ["consolidations"]);
  if (ws.kind === "client") {
    const groups = dropItems(clientNav(opts.clientFiles ?? [], opts.clientVisibleCards ?? null), opts.canOpenLoans === true ? [] : ["loans"]);
    if (!opts.lockedModules?.length) return groups;
    return groups.map((g, i) => (i === 0 ? { ...g, items: [...g.items, ADVISORY_LOCKED_ITEM] } : g));
  }
  return [];
}


function dropItems(groups: NavGroup[], ids: string[]): NavGroup[] {
  if (ids.length === 0) return groups;
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => !ids.includes(i.id)) }));
}
