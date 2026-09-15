import { ALL_WIDGETS, WIDGET_LABEL } from "@/lib/tiers";

/**
 * Display-only labels for card keys. Presentation, never a rule: the card
 * groupings and what a client may see both come from the database.
 */
const EXTRA_LABELS: Record<string, string> = {
  bank_reconciliation: "Bank Reconciliation",
  tax_liability: "Tax Liability",
};

export function cardLabel(card: string): string {
  return (
    (WIDGET_LABEL as Record<string, string>)[card] ??
    EXTRA_LABELS[card] ??
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
