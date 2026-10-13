import { describe, expect, it, beforeEach } from "vitest";

/**
 * The return-to path remembered after an inactivity sign-out (13 Oct 2026):
 * it must only ever be a same-origin absolute path — never an external URL,
 * never a scheme-relative "//host" — because it is fed to the router after
 * sign-in. It is presentation only; every destination keeps its own guard.
 */

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

// @ts-expect-error minimal window/localStorage for the module under test
globalThis.window = { localStorage: localStorageMock };
// @ts-expect-error same object
globalThis.localStorage = localStorageMock;

const { writeReturnTo, takeReturnTo, postAuthDestination, RETURN_TO_KEY } =
  await import("@/lib/session-cutoff");

describe("return-to after inactivity sign-out", () => {
  beforeEach(() => store.clear());

  it("remembers a same-origin path and returns it once", () => {
    writeReturnTo("/clients/abc/overview?tab=cash");
    expect(takeReturnTo()).toBe("/clients/abc/overview?tab=cash");
    expect(takeReturnTo()).toBeNull(); // one-shot
  });

  it("refuses external and scheme-relative URLs", () => {
    writeReturnTo("https://evil.example/steal");
    expect(takeReturnTo()).toBeNull();
    writeReturnTo("//evil.example/steal");
    expect(takeReturnTo()).toBeNull();
    writeReturnTo("javascript:alert(1)");
    expect(takeReturnTo()).toBeNull();
    writeReturnTo("\\evil");
    expect(takeReturnTo()).toBeNull();
  });

  it("falls back to the dashboard when nothing is stored", () => {
    expect(postAuthDestination()).toBe("/dashboard");
  });

  it("postAuthDestination consumes the stored path", () => {
    writeReturnTo("/system/organisations");
    expect(postAuthDestination()).toBe("/system/organisations");
    expect(postAuthDestination()).toBe("/dashboard");
  });

  it("ignores a tampered stored value", () => {
    store.set(RETURN_TO_KEY, "https://evil.example");
    expect(takeReturnTo()).toBeNull();
  });
});
