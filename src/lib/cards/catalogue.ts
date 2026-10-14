/**
 * Card catalogue shapes and pure helpers. The catalogue itself lives in the
 * database (public.card_catalogue / public.card_modules); nothing here decides
 * what a client may see — app_private.client_cards_v2 does.
 */
export type CardPackage = "standard" | "advisory" | "consolidation";
export type CatalogueModule = { key: string; label: string; description: string };
export type CatalogueCard = {
  key: string;
  package: CardPackage;
  module: string | null;
  label: string;
  description: string;
};
export type CardCatalogue = { modules: CatalogueModule[]; cards: CatalogueCard[] };

export const PACKAGE_LABEL: Record<CardPackage, string> = {
  standard: "Standard",
  advisory: "Advisory",
  consolidation: "Consolidation",
};

export const EMPTY_CATALOGUE: CardCatalogue = { modules: [], cards: [] };

export type ModuleState = "on" | "partial" | "off";

/** A module is ticked when all its cards are on, partial when some are. */
export function moduleState(cards: string[], on: ReadonlySet<string>): ModuleState {
  if (cards.length === 0) return "off";
  const n = cards.filter((c) => on.has(c)).length;
  return n === 0 ? "off" : n === cards.length ? "on" : "partial";
}

export function moduleCards(catalogue: CardCatalogue, moduleKey: string): string[] {
  return catalogue.cards.filter((c) => c.module === moduleKey).map((c) => c.key);
}

export function packageCards(catalogue: CardCatalogue, pkg: CardPackage): string[] {
  return catalogue.cards.filter((c) => c.package === pkg).map((c) => c.key);
}

/** Modules that currently hold at least one card, in catalogue order. */
export function activeModules(catalogue: CardCatalogue): CatalogueModule[] {
  return catalogue.modules.filter((m) => catalogue.cards.some((c) => c.module === m.key));
}

/**
 * Org default template from module ticks: Standard always, the ticked Advisory
 * modules' cards, and Consolidation when ticked. The database still filters to
 * what the purchase allows.
 */
export function defaultCardsFromModules(
  catalogue: CardCatalogue,
  modules: string[],
  consolidation: boolean,
): string[] {
  const set = new Set(packageCards(catalogue, "standard"));
  for (const m of modules) for (const c of moduleCards(catalogue, m)) set.add(c);
  if (consolidation) for (const c of packageCards(catalogue, "consolidation")) set.add(c);
  return [...set].sort();
}

/** Plain-text summary for Trixie's guide, built from the same catalogue. */
export function catalogueGuideText(catalogue: CardCatalogue): string {
  if (catalogue.cards.length === 0) return "";
  const line = (keys: CatalogueCard[]) => keys.map((c) => `${c.label} (${c.description})`).join("; ");
  const parts = [
    "Packages and modules (purchase is per organisation; the Organisation Owner ticks Advisory modules per client in Client settings → Package; Staff cannot change them):",
    `- Standard (always included): ${line(catalogue.cards.filter((c) => c.package === "standard"))}`,
  ];
  for (const m of activeModules(catalogue)) {
    parts.push(`- Advisory module "${m.label}": ${line(catalogue.cards.filter((c) => c.module === m.key))}`);
  }
  const cons = catalogue.cards.filter((c) => c.package === "consolidation");
  if (cons.length) parts.push(`- Consolidation (separate option, needs Advisory and more than one client): ${line(cons)}`);
  return parts.join("\n");
}

/** Maps rows from the two catalogue tables. */
export function mapCatalogue(modules: any[] | null, cards: any[] | null): CardCatalogue {
  return {
    modules: (modules ?? []).map((m) => ({ key: m.module_key, label: m.label, description: m.description ?? "" })),
    cards: (cards ?? []).map((c) => ({
      key: c.card_key,
      package: c.package as CardPackage,
      module: (c.module_key as string | null) ?? null,
      label: c.label,
      description: c.description ?? "",
    })),
  };
}
