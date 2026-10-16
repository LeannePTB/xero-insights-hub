import { STANDARD_ORDER } from "@/components/dashboard/dashboard-card-layout";

type Card = { card_key: string; package: string; module_key: string | null; sort_order: number; report_sections: string[] };
type Module = { module_key: string; sort_order: number };

/**
 * Report sections follow the dashboard: Standard cards first (dashboard
 * order), then Advisory modules by `card_modules.sort_order`, then card order
 * within a module, then each card's own section order. Sections no card owns
 * keep their incoming order at the end. Order only — never adds a section.
 */
export function orderReportSections(sections: readonly string[], cards: readonly Card[], modules: readonly Module[]): string[] {
  const modRank = new Map(modules.map((m) => [m.module_key, m.sort_order]));
  const std = (k: string) => { const i = STANDARD_ORDER.indexOf(k); return i < 0 ? 999 : i; };
  const ranked = [...cards].sort((a, b) => {
    const ga = a.package === "standard" ? -1 : a.package === "consolidation" ? 1e9 : modRank.get(a.module_key ?? "") ?? 1e8;
    const gb = b.package === "standard" ? -1 : b.package === "consolidation" ? 1e9 : modRank.get(b.module_key ?? "") ?? 1e8;
    if (ga !== gb) return ga - gb;
    if (a.package === "standard") return std(a.card_key) - std(b.card_key);
    return a.sort_order - b.sort_order;
  });
  const order: string[] = [];
  for (const c of ranked) for (const s of c.report_sections ?? []) if (!order.includes(s)) order.push(s);
  const pos = (s: string) => { const i = order.indexOf(s); return i < 0 ? order.length + sections.indexOf(s) : i; };
  return [...new Set(sections)].sort((a, b) => pos(a) - pos(b));
}
