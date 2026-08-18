/**
 * Plan-limit errors raised by database triggers.
 *
 * The triggers fire for every writer (service role included), so these messages
 * reach any code path that creates a client or connects a Xero organisation.
 * We surface the database's own wording — never a raw Postgres error, and never
 * a number we made up ourselves.
 */

export type PlanLimitKind = "clients" | "xero_orgs";

export type PlanLimitError = {
  kind: PlanLimitKind;
  /** The database's message with the machine code stripped off. */
  message: string;
};

function rawMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const anyErr = err as { message?: unknown; error_description?: unknown };
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.error_description === "string") return anyErr.error_description;
  }
  return "";
}

export function parsePlanLimitError(err: unknown): PlanLimitError | null {
  const raw = rawMessage(err);
  const match = /PLAN_LIMIT_(CLIENTS|XERO_ORGS)\s*:\s*([\s\S]*)/i.exec(raw);
  if (!match) return null;
  return {
    kind: match[1].toUpperCase() === "CLIENTS" ? "clients" : "xero_orgs",
    message: match[2].trim().replace(/\s+/g, " "),
  };
}

export function isPlanLimitError(err: unknown): boolean {
  return parsePlanLimitError(err) !== null;
}

/**
 * A clean, user-facing message. Plan-limit errors keep the database wording and
 * gain the current plan name; anything else is passed through unchanged.
 */
export function friendlyPlanError(err: unknown, opts?: { planLabel?: string | null }): string {
  const limit = parsePlanLimitError(err);
  if (!limit) return rawMessage(err) || "Something went wrong. Please try again.";
  const plan = opts?.planLabel?.trim();
  return plan ? `${limit.message} Current plan: ${plan}.` : limit.message;
}
