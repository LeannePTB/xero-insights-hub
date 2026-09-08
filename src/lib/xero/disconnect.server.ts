// Detaching ONE Xero organisation from this app.
//
// Two defects made the previous attempt a no-op, and both are fixed here:
//
//  1. It sent our own row id where Xero expects ITS connection id. Xero's
//     connection id is only obtainable from GET /connections, so it is looked
//     up at the moment of the disconnect and never stored — a stored one goes
//     stale the moment the owner reconnects.
//  2. It revoked the refresh token. A refresh token is issued per Xero USER
//     ACCOUNT and covers every organisation on it, so revoking would have
//     detached all of them. Nothing in this module touches tokens: it reads an
//     access token through the app's normal refresh path and does no more.
//
// Section 10: the tenant id is resolved server-side from our own rows by the
// caller and is only ever matched against Xero's own list — never taken from a
// request body.

import { getConnectionByTenant } from "./api.server";

const CONNECTIONS_URL = "https://api.xero.com/connections";
const TIMEOUT_MS = 20_000;

export type DisconnectOutcome =
  /** Xero confirmed the organisation is no longer attached to this app. */
  | { result: "detached"; remaining: number }
  /** Xero never listed it, so there is nothing on Xero's side to remove. */
  | { result: "already_detached"; remaining: number }
  /** The detach did not take; nothing local should be cleaned up. */
  | { result: "failed"; reason: string };

type XeroConnection = { id?: string; tenantId?: string; tenantType?: string };

async function listXeroConnections(accessToken: string): Promise<XeroConnection[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Xero returned ${res.status} listing connections.`);
    const body = await res.json();
    if (!Array.isArray(body)) throw new Error("Xero returned an unexpected connection list.");
    return body as XeroConnection[];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Detach one organisation and leave every other one on the same Xero account
 * alone. Verifies afterwards by asking Xero again: a detach is only reported
 * as done when the tenant has actually gone from Xero's own list.
 */
export async function detachTenantFromXero(tenantId: string): Promise<DisconnectOutcome> {
  let accessToken: string;
  try {
    const conn = await getConnectionByTenant(tenantId);
    accessToken = conn.access_token;
  } catch (e) {
    return {
      result: "failed",
      reason: `Could not obtain a Xero token for this organisation: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }

  let before: XeroConnection[];
  try {
    before = await listXeroConnections(accessToken);
  } catch (e) {
    return { result: "failed", reason: e instanceof Error ? e.message : String(e) };
  }

  const match = before.find((c) => c.tenantId === tenantId);
  if (!match?.id) {
    // Xero does not think this organisation is attached to us — most likely it
    // was disconnected inside Xero itself. Nothing to remove remotely.
    return { result: "already_detached", remaining: before.length };
  }

  try {
    const res = await fetch(`${CONNECTIONS_URL}/${match.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok && res.status !== 404) {
      return {
        result: "failed",
        reason: `Xero refused the disconnect (${res.status}): ${await res.text()}`,
      };
    }
  } catch (e) {
    return { result: "failed", reason: e instanceof Error ? e.message : String(e) };
  }

  // Verify. "Not found" is NOT proof — only Xero's list is.
  let after: XeroConnection[];
  try {
    after = await listXeroConnections(accessToken);
  } catch (e) {
    return {
      result: "failed",
      reason: `The disconnect was sent but could not be verified with Xero: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }

  if (after.some((c) => c.tenantId === tenantId)) {
    return {
      result: "failed",
      reason: "Xero still lists this organisation as connected, so it was not disconnected.",
    };
  }

  return { result: "detached", remaining: after.length };
}
