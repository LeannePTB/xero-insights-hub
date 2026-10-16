import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/session-cutoff", () => ({ postAuthDestination: () => "/clients/remembered" }));
import { routeAfterAuth } from "../src/lib/auth/route-after-auth";

describe("automatic post-auth routing retains MFA", () => {
  const mfa = (verified: boolean, aal: string) => ({
    listFactors: async () => ({ data: { totp: verified ? [{ status: "verified" }] : [] } }),
    getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal } }),
  });
  it("enrols when no verified factor exists", async () => {
    const navigate = vi.fn();
    await routeAfterAuth(mfa(false, "aal1"), navigate);
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/auth/mfa-enroll", replace: true });
  });
  it("never sends a password-only session straight to the dashboard", async () => {
    const navigate = vi.fn();
    await routeAfterAuth(mfa(true, "aal1"), navigate);
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/auth/mfa-verify", replace: true });
  });
  it("returns an MFA-verified session directly to its guarded destination", async () => {
    const navigate = vi.fn();
    await routeAfterAuth(mfa(true, "aal2"), navigate);
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/clients/remembered", replace: true });
  });
  it("fails rather than routing past an unreadable factor list", async () => {
    const navigate = vi.fn();
    await expect(routeAfterAuth({ ...mfa(true, "aal2"), listFactors: async () => ({ data: null, error: new Error("offline") }) }, navigate)).rejects.toThrow("offline");
    expect(navigate).not.toHaveBeenCalled();
  });
  it("propagates routing failures so the page can offer its fallback", async () => {
    await expect(routeAfterAuth(mfa(true, "aal2"), async () => { throw new Error("navigation failed"); })).rejects.toThrow("navigation failed");
  });
});