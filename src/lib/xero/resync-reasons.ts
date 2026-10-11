// Client-safe wording for manual Xero re-sync outcomes. No figures, no tokens.

export type ResyncOutcome =
  | "complete"
  | "partial"
  | "cooldown"
  | "reconnect"
  | "rate_limited"
  | "not_connected"
  | "failed";

export const RESYNC_REASON: Record<ResyncOutcome, string> = {
  complete: "Synced",
  partial: "Partly synced — some reports could not be read",
  cooldown: "Synced a moment ago — try again in a couple of minutes",
  reconnect: "Xero connection expired — reconnect",
  rate_limited: "Xero is busy — try again shortly",
  not_connected: "Not connected to Xero",
  failed: "Could not sync — try again later",
};

/** Map a refreshTenant failure reason to an outcome. Never echoes the message. */
export function outcomeFromFailure(reason: string | undefined | null): ResyncOutcome {
  const r = (reason ?? "").toLowerCase();
  if (/\b(401|403)\b|disconnect|expired|reconnect|invalid_grant|refresh token/.test(r)) return "reconnect";
  if (/\b429\b|rate limit|too many/.test(r)) return "rate_limited";
  return "failed";
}

/** Seconds per client used for the up-front estimate. */
export const RESYNC_SECONDS_PER_CLIENT = 20;

export function resyncEstimateMinutes(clients: number): number {
  return Math.max(1, Math.ceil((clients * RESYNC_SECONDS_PER_CLIENT) / 60));
}

/** Show the confirm-with-estimate step above this many clients. */
export const RESYNC_CONFIRM_ABOVE = 5;
