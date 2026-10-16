/**
 * Code-level feature flags (presentation and generation only — never an
 * access grant). Flip to true to restore the Business Health card, the
 * client-list health badge and the report health summary; nothing is deleted.
 */
export const BUSINESS_HEALTH_ENABLED = false;

/** Removes the Business Health card key from a visible-card list while hidden. */
export function withoutHiddenCards<T extends string>(keys: readonly T[]): T[] {
  return BUSINESS_HEALTH_ENABLED ? [...keys] : keys.filter((k) => k !== "health");
}
