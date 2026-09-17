export type OrganisationOptionState = {
  advisory: boolean;
  consolidation: boolean;
  branding: boolean;
  trialAdvisory: boolean;
  trialConsolidation: boolean;
  trialBranding: boolean;
  trialEndsAt: string | null;
  trialActive: boolean;
  effectiveAdvisory: boolean;
  effectiveConsolidation: boolean;
  effectiveBranding: boolean;
};

export type OrganisationOptionDisplay = {
  key: "advisory" | "consolidation" | "branding";
  label: "Advisory" | "Consolidation" | "Branding";
  on: boolean;
  trial: boolean;
};

/**
 * Display state is always the database-resolved effective state. Purchased
 * fields remain separate because the purchase editor still needs to edit them,
 * but they must never be used alone to describe what is available now.
 */
export function organisationOptionDisplay(
  state: OrganisationOptionState,
): OrganisationOptionDisplay[] {
  return [
    {
      key: "advisory",
      label: "Advisory",
      on: state.effectiveAdvisory,
      trial: state.trialActive && state.trialAdvisory && !state.advisory,
    },
    {
      key: "consolidation",
      label: "Consolidation",
      on: state.effectiveConsolidation,
      trial: state.trialActive && state.trialConsolidation && !state.consolidation,
    },
    {
      key: "branding",
      label: "Branding",
      on: state.effectiveBranding,
      trial: state.trialActive && state.trialBranding && !state.branding,
    },
  ];
}

/** Short Australian date for compact organisation summaries. */
export function organisationTrialEndLabel(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Perth",
  });
}