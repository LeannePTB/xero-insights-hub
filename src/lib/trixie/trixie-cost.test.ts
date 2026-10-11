import { describe, expect, it } from "vitest";
import { estimateTrixieCostUsd, maxOutputTokensForGuard } from "@/lib/trixie/trixie-cost";

const MODEL = "openai/gpt-6-astra";

describe("Trixie spend accounting", () => {
  it("prices a question from its token counts at list price", () => {
    // 10,000 input @ US$0.00001 = $0.10; 2,000 output @ US$0.00005 = $0.10
    expect(estimateTrixieCostUsd(MODEL, { inputTokens: 10_000, outputTokens: 2_000 })).toBe(0.2);
  });

  it("costs nothing when a question produced no tokens", () => {
    expect(estimateTrixieCostUsd(MODEL, { inputTokens: null, outputTokens: null })).toBe(0);
  });

  it("caps one question's answer at the US$0.25 cost guard", () => {
    // 80% of $0.25 at $0.00005 per output token.
    expect(maxOutputTokensForGuard(MODEL, 0.25)).toBe(4_000);
  });

  it("leaves the answer uncapped when no guard is set", () => {
    expect(maxOutputTokensForGuard(MODEL, null)).toBeUndefined();
  });
});
