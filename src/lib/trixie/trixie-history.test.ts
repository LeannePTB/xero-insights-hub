import { describe, expect, test } from "bun:test";
import { autoTitle, threadPathname, threadScopeFor, visibleReply } from "./trixie-history";

describe("saved Trixie chats", () => {
  test("client chats are tied to the verified client", () => {
    expect(threadScopeFor({ mode: "client", firmId: "f", clientId: "c" })).toEqual({ workspace: "client", firmId: "f", clientId: "c" });
  });
  test("System Admin chats never carry a client or organisation", () => {
    expect(threadScopeFor({ mode: "platform", firmId: "f", clientId: "c" })).toEqual({ workspace: "system", firmId: null, clientId: null });
  });
  test("a continued chat reopens on its own client, not the current page", () => {
    expect(threadPathname({ workspace: "client", firm_id: null, client_id: "abc" })).toBe("/clients/abc");
  });
  test("long first questions are shortened for the title", () => {
    expect(autoTitle("a".repeat(80)).length).toBe(58);
    expect(autoTitle("  How do I  connect Xero? ")).toBe("How do I connect Xero?");
  });
  test("tool payloads are never stored, only text and source labels", () => {
    const r = visibleReply([
      { type: "text", text: "Cash is fine." },
      { type: "tool-readCashPosition", state: "output-available", output: { cash: 4444.85, sources: [{ label: "Cash", asAt: "2026-10-11", href: "/clients/x" }] } },
    ]);
    expect(r).toEqual({ text: "Cash is fine.", sources: [{ label: "Cash", asAt: "2026-10-11", href: "/clients/x" }] });
    expect(JSON.stringify(r)).not.toContain("4444.85");
  });
});
