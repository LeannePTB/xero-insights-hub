import { describe, expect, it } from "vitest";
import {
  organisationOptionDisplay,
  organisationTrialEndLabel,
} from "../src/lib/organisation-option-display";

describe("organisation option display", () => {
  it("shows trial-only Advisory and Consolidation as on and trialled", () => {
    const options = organisationOptionDisplay({
      advisory: false,
      consolidation: false,
      branding: false,
      trialAdvisory: true,
      trialConsolidation: true,
      trialBranding: false,
      trialEndsAt: "2026-11-30T15:59:59.000Z",
      trialActive: true,
      effectiveAdvisory: true,
      effectiveConsolidation: true,
      effectiveBranding: false,
    });

    expect(options).toEqual([
      { key: "advisory", label: "Advisory", on: true, trial: true },
      { key: "consolidation", label: "Consolidation", on: true, trial: true },
      { key: "branding", label: "Branding", on: false, trial: false },
    ]);
    expect(organisationTrialEndLabel("2026-11-30T15:59:59.000Z")).toBe("30 Nov 2026");
  });

  it("does not label a purchased option as trialled", () => {
    const [advisory] = organisationOptionDisplay({
      advisory: true,
      consolidation: false,
      branding: false,
      trialAdvisory: true,
      trialConsolidation: false,
      trialBranding: false,
      trialEndsAt: "2026-11-30T15:59:59.000Z",
      trialActive: true,
      effectiveAdvisory: true,
      effectiveConsolidation: false,
      effectiveBranding: false,
    });

    expect(advisory).toMatchObject({ on: true, trial: false });
  });
});