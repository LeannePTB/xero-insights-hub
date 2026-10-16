import type { WidgetKey } from "@/lib/tiers";

/**
 * Who may be offered each deeper Trixie tool. Presentation of the tool list
 * only: every tool ALSO re-checks the card gate in the database
 * (assert_widget_access, as the caller) before it reads anything.
 *
 * - `staff`: active members of the client's own organisation (the database's
 *   `trixie_access_context` audience). Business Owners and Viewers never get it.
 * - `card`: the existing dashboard card that already exposes this data.
 * - `workspace`: "client" tools need a verified client route; "organisation"
 *   needs the caller's own organisation workspace (/firms/:id).
 */
export type DeepToolPolicy = {
  staffOnly: boolean;
  cards: readonly WidgetKey[];
  workspace: "client" | "organisation";
};

export const DEEP_TOOL_POLICY = {
  account_transactions: { staffOnly: true, cards: ["pnl"], workspace: "client" },
  journals: { staffOnly: true, cards: ["pnl"], workspace: "client" },
  contact_history: { staffOnly: false, cards: ["receivables", "payables"], workspace: "client" },
  bank_activity: { staffOnly: false, cards: ["cashflow"], workspace: "client" },
  pay_runs: { staffOnly: false, cards: ["superannuation"], workspace: "client" },
  compare_periods: { staffOnly: false, cards: ["pnl"], workspace: "client" },
  activity_statement: { staffOnly: false, cards: ["tax_obligations" as WidgetKey], workspace: "client" },
  find_issues: { staffOnly: true, cards: ["pnl"], workspace: "client" },
  practice_overview: { staffOnly: true, cards: [], workspace: "organisation" },
} as const satisfies Record<string, DeepToolPolicy>;

export type DeepToolName = keyof typeof DEEP_TOOL_POLICY;

export type ToolAudience = { mode: "platform" | "organisation" | "client" | "general"; audience: "platform" | "staff" | "viewer"; clientId: string | null };

/** Tools offered to this caller. System Admin gets none (how-to only). */
export function deepToolsFor(ctx: ToolAudience): DeepToolName[] {
  if (ctx.mode === "platform" || ctx.audience === "platform") return [];
  return (Object.keys(DEEP_TOOL_POLICY) as DeepToolName[]).filter((name) => {
    const p: DeepToolPolicy = DEEP_TOOL_POLICY[name];
    if (p.staffOnly && ctx.audience !== "staff") return false;
    if (p.workspace === "client") return ctx.mode === "client" && !!ctx.clientId;
    return ctx.mode === "organisation";
  });
}

/** Ready-made jobs: staff on a client page only. */
export function jobsAllowed(ctx: ToolAudience): boolean {
  return ctx.mode === "client" && ctx.audience === "staff" && !!ctx.clientId;
}

/** Field names a tool schema must never accept: identifiers are bound server-side. */
export const FORBIDDEN_SCHEMA_KEY = /(^|_)(id|ids)$|tenant|client|firm|organisation|organization|user/i;
