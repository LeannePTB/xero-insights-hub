/**
 * Code-level release settings (presentation and generation only — never an
 * access grant; entitlement stays `client_can_use_widget('health')`).
 *
 * Business Health is shown to practice users (anyone `me_can_manage_client`
 * returns true for) and stays hidden from client logins and from newly
 * generated monthly reports until it is released to clients here.
 */
export const BUSINESS_HEALTH_RELEASED_TO_CLIENTS = false;

/** Whether a caller may see the Business Health card for a client. */
export function canSeeBusinessHealth(isPractice: boolean): boolean {
  return isPractice || BUSINESS_HEALTH_RELEASED_TO_CLIENTS;
}
