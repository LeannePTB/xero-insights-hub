// Pure helpers for saved Trixie chats, shared by the route and tests.

export type ThreadScope = { workspace: "system" | "general" | "organisation" | "client"; firmId: string | null; clientId: string | null };

/** Workspace a new thread belongs to, from the reservation-verified context. */
export function threadScopeFor(ctx: { mode: string; firmId: string | null; clientId: string | null }): ThreadScope {
  if (ctx.mode === "client" && ctx.clientId) return { workspace: "client", firmId: ctx.firmId, clientId: ctx.clientId };
  if (ctx.mode === "organisation" && ctx.firmId) return { workspace: "organisation", firmId: ctx.firmId, clientId: null };
  if (ctx.mode === "platform") return { workspace: "system", firmId: null, clientId: null };
  return { workspace: "general", firmId: null, clientId: null };
}

/** The page a saved thread is continued from, so its scope never drifts to another client. */
export function threadPathname(thread: { workspace: string; firm_id: string | null; client_id: string | null }): string {
  if (thread.workspace === "client" && thread.client_id) return `/clients/${thread.client_id}`;
  if (thread.workspace === "organisation" && thread.firm_id) return `/firms/${thread.firm_id}/overview`;
  if (thread.workspace === "system") return "/system";
  return "/overview";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The scope a page asks for, from its path only (the server still verifies it). */
export function pageScope(pathname: string): ThreadScope {
  const path = (pathname || "/").split(/[?#]/)[0];
  const client = /^\/clients\/([0-9a-f-]{36})(?:\/|$)/i.exec(path)?.[1];
  if (client && UUID.test(client)) return { workspace: "client", firmId: null, clientId: client.toLowerCase() };
  const firm = /^\/firms\/([0-9a-f-]{36})(?:\/|$)/i.exec(path)?.[1];
  if (firm && UUID.test(firm)) return { workspace: "organisation", firmId: firm.toLowerCase(), clientId: null };
  if (path === "/system" || path.startsWith("/system/")) return { workspace: "system", firmId: null, clientId: null };
  return { workspace: "general", firmId: null, clientId: null };
}

/**
 * Whether a saved chat belongs to the page the person is on now. A chat from
 * another workspace (e.g. an old "general" chat while a client is open) is
 * never continued there: it would silently drop the open client's tools.
 */
export function threadMatchesPage(thread: { workspace: string; firm_id: string | null; client_id: string | null }, pathname: string): boolean {
  const page = pageScope(pathname);
  if (thread.workspace !== page.workspace) return false;
  if (page.workspace === "client") return (thread.client_id ?? "").toLowerCase() === page.clientId;
  if (page.workspace === "organisation") return (thread.firm_id ?? "").toLowerCase() === page.firmId;
  return true;
}

/** Auto-title like CoCo: the first question, tidied and shortened. */
export function autoTitle(question: string): string {
  const clean = question.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length <= 60 ? clean : `${clean.slice(0, 57).trimEnd()}…`;
}

export type StoredSource = { label: string; asAt: string | null; href?: string };

/** Only the visible text and the "Sources used" list are kept — never tool payloads. */
export function visibleReply(parts: Array<{ type: string; text?: string; state?: string; output?: unknown }>): { text: string; sources: StoredSource[] } {
  const text = parts.filter((p) => p.type === "text" && typeof p.text === "string").map((p) => p.text).join("\n").trim();
  const seen = new Map<string, StoredSource>();
  for (const p of parts) {
    if (!p.type.startsWith("tool-") || p.state !== "output-available") continue;
    const list = (p.output as { sources?: unknown } | null)?.sources;
    if (!Array.isArray(list)) continue;
    for (const s of list) {
      if (!s || typeof s !== "object" || typeof (s as any).label !== "string") continue;
      const label = String((s as any).label).slice(0, 200);
      const asAt = typeof (s as any).asAt === "string" ? (s as any).asAt.slice(0, 40) : null;
      const href = typeof (s as any).href === "string" && (s as any).href.startsWith("/") ? (s as any).href.slice(0, 300) : undefined;
      seen.set(label, href ? { label, asAt, href } : { label, asAt });
    }
  }
  return { text: text.slice(0, 20000), sources: [...seen.values()].slice(0, 20) };
}
