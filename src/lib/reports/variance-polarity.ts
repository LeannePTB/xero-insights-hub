// Monthly Management Report — the SINGLE place that decides whether a movement
// is favourable or unfavourable. Key figures, the Profit and Loss table, the
// on-screen preview and the PDF renderer all call this; do not reimplement it.
//
// The arrow shows DIRECTION. The colour shows JUDGEMENT. They are separate:
// revenue up is a green ▲, an expense up is a red ▲.
//
// Presentation only — nothing here changes a computed figure.

import { money, pct } from "./monthly-report";

export type Polarity = "higher-better" | "lower-better" | "unknown";

/**
 * Polarity of a Profit and Loss line, decided from the section it sits in —
 * never from the account name. An unrecognised section is `unknown` and is
 * rendered without colour: colouring a line the wrong way tells the client the
 * opposite of the truth, which is worse than not colouring it at all.
 */
export function sectionPolarity(sectionTitle: string | null | undefined): Polarity {
  const t = (sectionTitle ?? "").toLowerCase().trim();
  if (!t) return "unknown";

  // Lower is better — costs and expenses.
  if (t.includes("cost of sales") || t.includes("direct cost")) return "lower-better";
  if (t.includes("expense") || t.includes("overhead")) return "lower-better";

  // Higher is better — income and the profit summaries.
  if (t.includes("gross profit")) return "higher-better";
  if (t.includes("net profit") || t.includes("net loss") || t.includes("profit for")) {
    return "higher-better";
  }
  if (t.includes("income") || t.includes("revenue") || t.includes("sales")) {
    return "higher-better";
  }

  return "unknown";
}

/** Polarity of a Key figure row, keyed off the stable payload key. */
export function keyFigurePolarity(key: string): Polarity {
  switch (key) {
    case "revenue":
    case "profit_after_tax":
    case "net_margin":
      return "higher-better";
    case "expenses":
      return "lower-better";
    default:
      return "unknown";
  }
}

export type VarianceTone = "good" | "bad" | "neutral";

export type VarianceJudgement = {
  /** "▲", "▼" or "" when there is no movement to point at. */
  arrow: string;
  tone: VarianceTone;
  /** Whether the percentage is meaningful and may be shown. */
  showPct: boolean;
  /** Plain-language meaning, for title/aria-label so colour is never the only cue. */
  label: string;
};

export type JudgeInput = {
  variance: number | null | undefined;
  /** The prior-period figure the variance is measured against. */
  prior: number | null | undefined;
  polarity: Polarity;
  /** Percentage variance as computed upstream, or null when not available. */
  variancePct?: number | null;
  /** Formats the dollar/percentage amount for the spoken label. */
  unit?: "money" | "percent";
  /** True when there is genuinely no prior period to compare against. */
  noPriorPeriod?: boolean;
};

/**
 * Judge a single movement. Handles the awkward cases explicitly:
 * - zero / non-finite variance → neutral, no arrow
 * - no prior period, or a nil base → arrow only, never coloured
 * - sign flips and contra (negative) prior amounts → judged on the direction of
 *   the movement itself, so a negative base cannot invert the colour
 * - percentages against a nil or negative base are meaningless and suppressed
 */
export function judgeVariance(input: JudgeInput): VarianceJudgement {
  const v = input.variance;
  const prior = input.prior ?? 0;
  const unit = input.unit ?? "money";
  const fmt = (n: number) => (unit === "money" ? money(Math.abs(n)) : pct(Math.abs(n)));

  if (v === null || v === undefined || !Number.isFinite(v) || v === 0) {
    return { arrow: "", tone: "neutral", showPct: false, label: "no change on the prior period" };
  }

  const up = v > 0;
  const arrow = up ? "▲" : "▼";
  const direction = up ? "up" : "down";

  // A percentage is only meaningful against a positive base.
  const basePositive = Number.isFinite(prior) && prior > 0;
  const showPct =
    !input.noPriorPeriod &&
    basePositive &&
    input.variancePct !== null &&
    input.variancePct !== undefined &&
    Number.isFinite(input.variancePct);

  const amountText = showPct
    ? `${Math.abs(input.variancePct as number).toFixed(1)}%`
    : fmt(v);

  if (input.noPriorPeriod || prior === 0) {
    return {
      arrow,
      tone: "neutral",
      showPct: false,
      label: `${direction} ${fmt(v)} — no prior period to compare against`,
    };
  }

  if (input.polarity === "unknown") {
    return { arrow, tone: "neutral", showPct, label: `${direction} ${amountText}` };
  }

  const favourable = input.polarity === "higher-better" ? up : !up;
  return {
    arrow,
    tone: favourable ? "good" : "bad",
    showPct,
    label: `${direction} ${amountText} — ${favourable ? "favourable" : "unfavourable"}`,
  };
}

/** Tailwind text colour for a tone, using theme tokens (never raw hex). */
export function toneClass(tone: VarianceTone): string {
  if (tone === "good") return "text-success";
  if (tone === "bad") return "text-destructive";
  return "";
}

/**
 * Print-legible RGB for the PDF. Darker than the on-screen tokens so both read
 * clearly on paper and in greyscale.
 */
export function toneRgb(tone: VarianceTone): [number, number, number] {
  if (tone === "good") return [21, 105, 70];
  if (tone === "bad") return [163, 28, 28];
  return [17, 24, 39];
}
