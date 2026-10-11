import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rankTrixieArticles, searchWords } from "@/lib/trixie/trixie-knowledge";
import { isKnownAppPath, trixiePageMap, trixieRoutePatterns } from "@/lib/trixie/trixie-pagemap";

const articles = [
  { id: "1", title: "Adding a client", body: "Use Add from Xero or New client. Client limits apply.", tags: ["clients", "starter"] },
  { id: "2", title: "Card defaults", body: "Settings → Card defaults sets which cards new clients get.", tags: ["cards", "starter"] },
  { id: "3", title: "Monthly reports", body: "Prepare, preview and send a monthly report. The report logo order is organisation then platform.", tags: ["reports"] },
];
const FIRM = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";

describe("Trixie help ranking", () => {
  it("matches on individual words, not the whole question", () => {
    expect(rankTrixieArticles("How do I change the card defaults for my organisation?", articles)[0].id).toBe("2");
  });
  it("ranks title matches above body mentions", () => {
    expect(rankTrixieArticles("monthly report logo", articles)[0].id).toBe("3");
  });
  it("folds plurals so 'clients' finds 'Adding a client'", () => {
    expect(rankTrixieArticles("adding clients", articles)[0].id).toBe("1");
  });
  it("returns nothing when no word matches, rather than the newest articles", () => {
    expect(rankTrixieArticles("payroll leave balances", articles)).toEqual([]);
  });
  it("drops stop words", () => {
    expect(searchWords("How do I use this page?")).toEqual([]);
  });
  it("returns at most the requested number", () => {
    expect(rankTrixieArticles("client card report", articles, 2)).toHaveLength(2);
  });
});

describe("Trixie page map", () => {
  it("only lists patterns that are real routes", () => {
    const tree = readFileSync("src/routeTree.gen.ts", "utf8");
    for (const p of trixieRoutePatterns()) expect(tree).toContain(`'${p}'`);
  });
  it("gives platform staff System Admin pages only", () => {
    const paths = trixiePageMap({ mode: "platform", audience: "platform", firmId: null, clientId: null }).map((p) => p.path);
    expect(paths).toContain("/system/trixie");
    expect(paths.some((p) => p.startsWith("/firms/") || p.startsWith("/clients/"))).toBe(false);
  });
  it("gives a business owner only their client's dashboard and reports", () => {
    const paths = trixiePageMap({ mode: "client", audience: "viewer", firmId: FIRM, clientId: CLIENT }).map((p) => p.path);
    expect(paths).toContain(`/clients/${CLIENT}`);
    expect(paths).toContain(`/clients/${CLIENT}/reports`);
    expect(paths.some((p) => p.includes("/settings/") && p.startsWith("/clients/"))).toBe(false);
    expect(paths.some((p) => p.startsWith("/firms/") || p.startsWith("/system"))).toBe(false);
  });
  it("fills the organisation ID for staff", () => {
    const paths = trixiePageMap({ mode: "organisation", audience: "staff", firmId: FIRM, clientId: null }).map((p) => p.path);
    expect(paths).toContain(`/firms/${FIRM}/settings/cards`);
    expect(paths.every((p) => !p.includes("$"))).toBe(true);
  });
  it("recognises only real in-app paths as links", () => {
    expect(isKnownAppPath(`/firms/${FIRM}/settings/cards`)).toBe(true);
    expect(isKnownAppPath(`/clients/${CLIENT}/settings/tax-reporting`)).toBe(true);
    expect(isKnownAppPath("/made-up-page")).toBe(false);
    expect(isKnownAppPath("https://example.com/system")).toBe(false);
    expect(isKnownAppPath("//evil.example/system")).toBe(false);
  });
});
