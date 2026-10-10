/**
 * Trixie spend accounting.
 *
 * List prices for the approved model, in US dollars per token, as published by
 * the AI gateway catalogue. Used for two things only: the metadata-only cost
 * recorded against a question, and the per-question cost guard.
 */
export const TRIXIE_MODEL_RATES = {
  "openai/gpt-6-astra": {
    inputPerToken: 0.00001,
    inputPerTokenAboveLongContext: 0.00002,
    outputPerToken: 0.00005,
    outputPerTokenAboveLongContext: 0.000075,
    longContextTokens: 272_000,
  },
} as const;

export type TrixieModel = keyof typeof TRIXIE_MODEL_RATES;

function rates(model: string) {
  return TRIXIE_MODEL_RATES[model as TrixieModel] ?? TRIXIE_MODEL_RATES["openai/gpt-6-astra"];
}

/** Estimated US dollar cost of one question, from its token counts. */
export function estimateTrixieCostUsd(
  model: string,
  usage: { inputTokens?: number | null; outputTokens?: number | null },
): number {
  const r = rates(model);
  const input = Math.max(0, usage.inputTokens ?? 0);
  const output = Math.max(0, usage.outputTokens ?? 0);
  const long = input > r.longContextTokens;
  const inputCost = long
    ? r.longContextTokens * r.inputPerToken + (input - r.longContextTokens) * r.inputPerTokenAboveLongContext
    : input * r.inputPerToken;
  const outputCost = long ? output * r.outputPerTokenAboveLongContext : output * r.outputPerToken;
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * The cost guard caps what a single question may spend. Most of a question's
 * cost is its answer, so the guard becomes a hard output-token ceiling; the
 * remaining fifth covers the prompt and the help articles read.
 */
export function maxOutputTokensForGuard(model: string, guardUsd: number | null | undefined): number | undefined {
  if (guardUsd == null || !Number.isFinite(guardUsd) || guardUsd <= 0) return undefined;
  const r = rates(model);
  const tokens = Math.floor((guardUsd * 0.8) / r.outputPerToken);
  return Math.max(256, Math.min(tokens, 32_000));
}
