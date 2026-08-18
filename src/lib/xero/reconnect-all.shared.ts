/** Shared, browser-safe types and constants for the bulk Xero reconnect. */

/** Guard against an unusable authorise URL / state row. */
export const MAX_BULK_RECONNECT_TENANTS = 25;

export type FirmXeroFile = {
  connectionId: string;
  tenantId: string;
  tenantName: string;
  status: string;
  missingScopes: string[];
};
