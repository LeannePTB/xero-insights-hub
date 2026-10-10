import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function luminance(hex: string) {
  const c = hex.replace("#", "").match(/../g)!.map((v) => parseInt(v, 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("brand text contrast", () => {
  const css = readFileSync("src/styles.css", "utf8");
  for (const mode of [":root", ".dark"]) {
    const block = css.split(`${mode} {`)[1].split("}")[0];
    const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
    if (mode === ".dark") tokens["brand-navy"] = "#002A5F";
    const pairs = [
      ["foreground", "background"], ["card-foreground", "card"],
      ["primary-foreground", "primary"], ["accent-foreground", "accent"],
      ["muted-foreground", "muted"], ["link", "background"],
      ["info-foreground", "info"], ["info", "info-surface"],
      ["success-foreground", "success"], ["destructive-foreground", "destructive"],
      ["sidebar-foreground", "sidebar"], ["sidebar-accent-foreground", "sidebar-accent"],
      ["emphasis", "background"],
    ];
    for (const [fg, bg] of pairs) {
      it(`${mode}: ${fg} on ${bg} meets AA`, () => {
        expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it("uses navy, not white, on light brand blues", () => {
    expect(contrast("#002A5F", "#00B5EE")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#002A5F", "#0091D5")).toBeGreaterThanOrEqual(4.5);
  });
});