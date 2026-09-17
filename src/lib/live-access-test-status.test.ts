import { describe, expect, it } from "vitest";
import {
  LIVE_ACCESS_SIGN_IN_COUNTS,
  classifyLiveAccessHttpFailure,
} from "./live-access-test-status";

describe("live access-test rate-limit reporting", () => {
  it("documents four steady-state sign-ins and seven only during initial TOTP setup", () => {
    expect(LIVE_ACCESS_SIGN_IN_COUNTS).toEqual({
      steadyState: 4,
      firstRunWithTotpEnrollment: 7,
    });
  });

  it("reports a 429 as incomplete rather than passed or failed", () => {
    expect(classifyLiveAccessHttpFailure(429, '{"error":"Rate limited"}')).toEqual({
      incomplete: true,
      message:
        'live access tests: INCONCLUSIVE — run did not complete (429 rate limited). {"error":"Rate limited"}',
    });
  });

  it("keeps non-rate-limit trigger failures as failures", () => {
    expect(classifyLiveAccessHttpFailure(500, "broken")).toEqual({
      incomplete: false,
      message: "live access tests: FAILED to trigger (500) broken",
    });
  });
});