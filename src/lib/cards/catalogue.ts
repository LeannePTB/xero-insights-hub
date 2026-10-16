import { BUSINESS_HEALTH_ENABLED } from "@/lib/config/features";
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
  /** Monthly report sections this card adds (card_catalogue.report_sections). */
  reportSections?: string[];
  /** "wip" = Work in progress: not offered. Only System Administrators can read WIP rows. */
  status?: "available" | "wip";
  /** Opt-out tick: left out of the automatic Coming soon teasers while Work in progress. */
  comingSoonHidden?: boolean;
  /** Work in progress, shown only because this client's organisation has early access. */
  earlyAccess?: boolean;
};
export type CardCatalogue = { modules: CatalogueModule[]; cards: CatalogueCard[] };

export const PACKAGE_LABEL: Record<CardPackage, string> = {
  standard: "Standard",
  advisory: "Advisory",
  consolidation: "Consolidation",
};

/** The catalogue as offered: Work-in-progress cards removed, and any module left empty with them. */
export function offeredCatalogue(catalogue: CardCatalogue): CardCatalogue {
  const cards = catalogue.cards.filter((c) => c.status !== "wip");
  return { cards, modules: catalogue.modules.filter((m) => cards.some((c) => c.module === m.key)) };
}

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
    // Retired cards are kept in the database for the record and never shown.
    cards: (cards ?? []).filter((c) => c.status !== "retired" && (BUSINESS_HEALTH_ENABLED || c.card_key !== "health")).map((c) => ({
      key: c.card_key,
      package: c.package as CardPackage,
      module: (c.module_key as string | null) ?? null,
      label: c.label,
      description: c.description ?? "",
      reportSections: Array.isArray(c.report_sections) ? (c.report_sections as string[]) : [],
      status: c.status === "wip" ? "wip" : "available",
      comingSoonHidden: !!c.hide_from_coming_soon,
    })),
  };
}

/** Plain labels for report sections (presentation only). */
export const REPORT_SECTION_LABEL: Record<string, string> = {
  verdict: "This month (health summary)",
  charts: "Charts",
  notes: "Notes",
  key_figures: "Key figures",
  profit_and_loss: "Profit and Loss",
  receivables: "Receivables detail",
  payables: "Payables detail",
};

/** Report sections a set of cards adds, from the catalogue (one list). */
export function reportSectionsForCards(catalogue: CardCatalogue, cards: readonly string[]): string[] {
  const out = new Set<string>();
  for (const c of catalogue.cards) if (cards.includes(c.key)) for (const s of c.reportSections ?? []) out.add(s);
  return [...out];
}

/**
 * Adds caller-scoped early-access rows (public.client_early_access_cards) to a
 * catalogue. Presentation only: the database already decided they may be shown.
 */
export function withEarlyAccess(catalogue: CardCatalogue, rows: any[] | null): CardCatalogue {
  const extra = mapCatalogue([], rows).cards
    .filter((c) => !catalogue.cards.some((x) => x.key === c.key))
    .map((c) => ({ ...c, status: "wip" as const, earlyAccess: true }));
  if (extra.length === 0) return catalogue;
  return { modules: catalogue.modules, cards: [...catalogue.cards, ...extra] };
}
