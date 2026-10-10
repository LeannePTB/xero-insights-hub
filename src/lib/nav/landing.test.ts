import { describe, it, expect } from "vitest";
import { landingFor } from "./landing";

const base = { isPlatformStaff: false, isPracticeMember: false, firmIds: [] as string[], viewerClientIds: [] as string[] };

describe("landingFor", () => {
  it("sends platform staff to System Admin", () => {
    expect(landingFor({ ...base, isPlatformStaff: true, firmIds: ["f1"] })).toEqual({ to: "/system" });
  });
  it("sends a one-organisation member to that organisation's Overview, without practice team", () => {
    expect(landingFor({ ...base, firmIds: ["f1"] })).toEqual({ to: "/firms/$firmId/overview", firmId: "f1" });
  });
  it("sends a member of several organisations to the cross-organisation Overview", () => {
    expect(landingFor({ ...base, firmIds: ["f1", "f2"] })).toEqual({ to: "/overview" });
  });
  it("sends a viewer with one client to that dashboard", () => {
    expect(landingFor({ ...base, viewerClientIds: ["c1"] })).toEqual({ to: "/clients/$clientId", clientId: "c1" });
  });
  it("shows the chooser to a viewer with several clients", () => {
    expect(landingFor({ ...base, viewerClientIds: ["c1", "c2"] })).toEqual({ to: "chooser" });
  });
  it("shows no-access when nothing applies", () => {
    expect(landingFor(base)).toEqual({ to: "none" });
  });
});
