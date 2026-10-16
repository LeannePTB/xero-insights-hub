import { createContext, useContext, type ReactNode } from "react";

/** The card's catalogue name (System Admin editable). Display only. */
const CardTitleContext = createContext<string | null>(null);

export function CardTitleProvider({ title, children }: { title: string | null | undefined; children: ReactNode }) {
  return <CardTitleContext.Provider value={title?.trim() || null}>{children}</CardTitleContext.Provider>;
}

/** Catalogue name when the card is rendered inside a catalogue slot, else the fallback. */
export function useCardTitle(fallback: string): string {
  return useContext(CardTitleContext) ?? fallback;
}
