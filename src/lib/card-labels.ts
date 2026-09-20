import { ALL_WIDGETS, WIDGET_LABEL } from "@/lib/tiers";

/**
 * Display-only labels for card keys. Presentation, never a rule: the card
 * groupings and what a client may see both come from the database.
 *
 * There is no second list of labels for cards the app cannot draw. On
 * 20 September 2026 `bank_reconciliation` and `tax_liability` were removed from
 * the catalogue and from every client's ticked list: neither had ever drawn a
 * card, Tax Liability having been superseded by the GST activity statement and
 * PAYG Withholding cards and Bank Reconciliation by Uncoded Bankfeed Questions.
 * tests/card-catalogue.test.ts now fails the build if the catalogue names a card
 * the dashboard has no component for.
 */
export function cardLabel(card: string): string {
  return (
    (WIDGET_LABEL as Record<string, string>)[card] ??
    card.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** True for card keys the app does not render a card for yet. */
export function cardNotBuilt(card: string): boolean {
  return !(ALL_WIDGETS as readonly string[]).includes(card);
}

export const CARD_GROUP_LABEL: Record<string, string> = {
  standard: "Standard",
  advisory: "Advisory",
  consolidation: "Consolidation",
};
