import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const load = async () => await import("../src/lib/xero/file-ceiling.server");

describe("per-file hourly Xero ceiling", () => {
  it("counts one call per outbound request, hourly, keyed by tenant", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    const { enforceXeroFileCeiling, XERO_FILE_HOUR_CEILING } = await load();
    await enforceXeroFileCeiling("tenant-abc");
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", {
      _key: "xero_file_hour:tenant-abc",
      _max: XERO_FILE_HOUR_CEILING,
      _window_seconds: 3600,
    });
  });

  it("refuses the call once the ceiling is reached", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    const { enforceXeroFileCeiling, XERO_FILE_CEILING_MESSAGE } = await load();
    await expect(enforceXeroFileCeiling("tenant-abc")).rejects.toThrow(XERO_FILE_CEILING_MESSAGE);
  });

  it("fails open when the limiter itself errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    const { enforceXeroFileCeiling } = await load();
    await expect(enforceXeroFileCeiling("tenant-abc")).resolves.toBeUndefined();
  });

  it("is recognised as a rate-limit pause by the shared predicate", async () => {
    const { XERO_FILE_CEILING_MESSAGE } = await load();
    const { isXeroRateLimitMessage } = await import("../src/lib/xero/api.server");
    expect(isXeroRateLimitMessage(XERO_FILE_CEILING_MESSAGE)).toBe(true);
  });

  it("keeps the ceiling well above normal use and well below Xero's daily allowance", async () => {
    const { XERO_FILE_HOUR_CEILING } = await load();
    expect(XERO_FILE_HOUR_CEILING).toBeGreaterThan(60);
    expect(XERO_FILE_HOUR_CEILING).toBeLessThan(1000);
  });
});
