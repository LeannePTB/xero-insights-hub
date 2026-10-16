import { INACTIVITY_WINDOW_MS } from "@/lib/session-cutoff";

/**
 * Pure rules for the browser half of the inactivity timeout (16 Oct 2026).
 *
 * Root cause of the owner being signed out while working: the browser extended
 * its own deadline on every click, but only told the SERVER at most once a
 * minute and only on click/keypress. Scrolling, wheel, touch and returning to
 * the tab were never counted, and the browser deadline ran ahead of the
 * server-held `last_activity_at`. So the server window could close while the
 * browser still thought the person was active, and the next card load was
 * refused with SESSION_IDLE ("Your session ended").
 *
 * Fix, expressed here so it can be tested without a browser:
 * - the browser deadline is anchored to the last time the SERVER confirmed
 *   activity, never to a local click alone, so the browser can only ever end
 *   the session at or before the server would;
 * - real interaction sends a heartbeat at most once every HEARTBEAT_MIN_INTERVAL_MS,
 *   never from a hidden tab and never on a timer alone.
 */
export const HEARTBEAT_MIN_INTERVAL_MS = 2 * 60_000;

/** Browser events that count as a person really using the page. */
export const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
] as const;

export function shouldHeartbeat(opts: {
  now: number;
  lastTouchAt: number;
  hidden: boolean;
  force?: boolean;
}): boolean {
  if (opts.hidden) return false;
  if (opts.force) return true;
  return opts.now - opts.lastTouchAt >= HEARTBEAT_MIN_INTERVAL_MS;
}

/** The browser deadline follows the server's confirmed activity time. */
export function deadlineFromServerTouch(touchedAt: number): number {
  return touchedAt + INACTIVITY_WINDOW_MS;
}
