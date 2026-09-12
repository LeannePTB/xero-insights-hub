/**
 * Server-only: who the current request belongs to, for AUDIT ATTRIBUTION ONLY.
 *
 * This is never an access decision. `requireAal2` stores the user id it has
 * already verified (through the generated Supabase middleware) against the
 * current `Request` object, so a helper deep in a read path — `readSnapshot`,
 * for instance — can name the actor in an audit row without every caller
 * threading a user id through its signature.
 *
 * Scope is one inbound request: a WeakMap keyed on the `Request` object, so two
 * concurrent requests can never see each other's actor and the entry is
 * collected with the request. Background work (cron, the daily snapshot writer)
 * has no request and therefore no actor, which is exactly right — nobody read
 * anything.
 */
import { getRequest } from "@tanstack/react-start/server";

const actors = new WeakMap<object, string>();

function currentRequest(): object | null {
  try {
    const request: unknown = getRequest();
    return request && typeof request === "object" ? (request as object) : null;
  } catch {
    return null;
  }
}

export function setRequestActor(userId: string | null | undefined): void {
  if (!userId) return;
  const request = currentRequest();
  if (request) actors.set(request, userId);
}

export function getRequestActor(): string | null {
  const request = currentRequest();
  if (!request) return null;
  return actors.get(request) ?? null;
}
