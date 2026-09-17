import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  classificationChoice,
  classificationSourceLabel,
} from "./cost-classification-display";
import type { ResolvedClassification } from "@/lib/cost-classification";

function resolved(
  values: Partial<ResolvedClassification>,
): ResolvedClassification {
  return {
    effective: "fixed",
    decided: null,
    source: "default",
    xeroType: null,
    isWages: false,
    unclassified: true,
    ...values,
  };
}

describe("cost classification display", () => {
  test("shows a true fallback as Unclassified while retaining fixed calculation treatment", () => {
    const value = resolved({ effective: "fixed", decided: null, unclassified: true });
    assert.equal(classificationChoice(value), "unclassified");
    assert.equal(classificationSourceLabel(value),
      "No classification saved · treated as fixed",
    );
  });

  test("distinguishes Xero seeds from hand-chosen classifications", () => {
    const seeded = resolved({
      effective: "variable",
      decided: "variable",
      source: "xero",
      xeroType: "DIRECTCOSTS",
      unclassified: false,
    });
    const chosen = resolved({
      effective: "variable",
      decided: "variable",
      source: "manual",
      unclassified: false,
    });

    assert.equal(classificationChoice(seeded), "variable");
    assert.equal(classificationSourceLabel(seeded), "Seeded from Xero · cost of sales");
    assert.equal(classificationSourceLabel(chosen), "Chosen by hand");
  });
});
