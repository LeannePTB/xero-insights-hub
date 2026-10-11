// Ranking for Trixie's help library. The database decides WHICH articles the
// caller may read (active, audience-filtered, aal2); this only orders them.

export type TrixieArticle = { id?: string; title: string; body: string; tags: string[] | null };

const STOP = new Set(
  "the and for how what can does this that with from are you use your into about which when where who why our out get set its has have was will there here been then them they their page show shows see want need help please trixie tell me do i a an to of in on is it my".split(" "),
);

/** Lower-case search words, de-duplicated, stop words removed, simple plurals folded. */
export function searchWords(query: string): string[] {
  const words = (query ?? "")
    .toLowerCase()
    .slice(0, 500)
    .split(/[^a-z0-9&]+/)
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return Array.from(new Set(words)).slice(0, 12);
}

function countMatches(haystack: string, word: string): number {
  let n = 0;
  let i = haystack.indexOf(word);
  while (i !== -1 && n < 20) {
    n += 1;
    i = haystack.indexOf(word, i + word.length);
  }
  return n;
}

/** Score one article: title words weigh most, then tags, then body mentions. */
export function scoreArticle(article: TrixieArticle, words: string[], phrase = ""): number {
  if (!words.length) return 0;
  const title = article.title.toLowerCase();
  const tags = (article.tags ?? []).map((t) => t.toLowerCase());
  const body = article.body.toLowerCase();
  let score = 0;
  let matched = 0;
  for (const w of words) {
    const inTitle = title.includes(w);
    const inTags = tags.some((t) => t.includes(w));
    const bodyHits = countMatches(body, w);
    if (inTitle || inTags || bodyHits) matched += 1;
    score += (inTitle ? 6 : 0) + (inTags ? 4 : 0) + Math.min(bodyHits, 5);
  }
  // Reward articles covering more of the question, and an exact phrase.
  score *= 1 + matched / words.length;
  const p = phrase.trim().toLowerCase();
  if (p.length >= 6 && (title.includes(p) || body.includes(p))) score += 10;
  return Math.round(score * 100) / 100;
}

/** Best matches first; articles that match nothing are left out. */
export function rankTrixieArticles<T extends TrixieArticle>(query: string, articles: T[], limit = 3): T[] {
  const words = searchWords(query);
  return articles
    .map((article, index) => ({ article, index, score: scoreArticle(article, words, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .map((r) => r.article);
}
