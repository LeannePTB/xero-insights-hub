import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function luminance(colour: string) {
  let channels: number[];
  if (colour.startsWith("#")) {
    const pairs = colour.slice(1).match(/../g);
    if (!pairs || pairs.length !== 3) throw new Error(`Invalid colour ${colour}`);
    channels = pairs.map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  } else {
    const values = colour.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/);
    if (!values) throw new Error(`Invalid colour ${colour}`);
    const L = Number(values[1]), C = Number(values[2]), h = Number(values[3]) * Math.PI / 180;
    const a = C * Math.cos(h), b = C * Math.sin(h);
    const l = (L + .3963377774 * a + .2158037573 * b) ** 3;
    const m = (L - .1055613458 * a - .0638541728 * b) ** 3;
    const s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
    channels = [4.0767416621*l - 3.3077115913*m + .2309699292*s, -1.2684380046*l + 2.6097574011*m - .3413193965*s, -.0041960863*l - .7034186147*m + 1.707614701*s].map(v => Math.max(0, Math.min(1, v)));
  }
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
const css = readFileSync("src/styles.css", "utf8");
function block(mode: string) {
  const text = css.split(`${mode} {`)[1].split("}")[0];
  const raw = Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(oklch\([^)]*\)|#[\da-fA-F]{6}|var\(--[\w-]+\))/g)].map(m => [m[1],m[2]]));
  return raw;
}
const root = block(":root");
function resolve(tokens: Record<string,string>, key: string): string {
  const value = tokens[key];
  if (!value) throw new Error(`Missing token ${key}`);
  const alias = value.match(/^var\(--([\w-]+)\)$/);
  return alias ? resolve(tokens, alias[1]) : value;
}
describe("brand text contrast", () => {
  for (const mode of [":root", ".dark"]) {
    const tokens = { ...root, ...block(mode) };
    const pairs = [
      ["foreground","background"], ["card-foreground","card"], ["popover-foreground","popover"],
      ["primary-foreground","primary"], ["primary-foreground","primary-strong"], ["accent-foreground","accent"],
      ["muted-foreground","muted"], ["muted-foreground","background"], ["muted-foreground","card"],
      ["link","background"], ["link","card"], ["info-foreground","info"], ["info","info-surface"],
      ["success-foreground","success"], ["destructive-foreground","destructive"],
      ["sidebar-foreground","sidebar"], ["sidebar-accent-foreground","sidebar-accent"], ["emphasis","background"],
    ];
    for (const [fg,bg] of pairs) it(`${mode}: ${fg} on ${bg} meets AA`, () => {
      expect(contrast(resolve(tokens,fg),resolve(tokens,bg))).toBeGreaterThanOrEqual(4.5);
    });
    for (const bg of ["background","card","muted"]) it(`${mode}: focus against ${bg} meets non-text AA`, () => {
      expect(contrast(resolve(tokens,"ring"),resolve(tokens,bg))).toBeGreaterThanOrEqual(3);
    });
  }
  const official: Record<string,string> = { "brand-navy":"#082E5E", "brand-royal":"#28468E", "brand-mid":"#426CB2", "brand-blue":"#1E90D1", "brand-sky":"#1E90D1", "brand-cyan":"#4EB4EB", "brand-black":"#080909", "brand-grey":"#939598", "primary":"#28468E", "link":"#426CB2", "ring":"#426CB2", "accent":"#1E90D1", "highlight":"#4EB4EB" };
  for (const [key,hex] of Object.entries(official)) it(`${key} matches official swatch luminance`, () => {
    expect(luminance(resolve(root,key))).toBeCloseTo(luminance(hex),6);
  });
  for (const [index,hex] of ["#4EB4EB","#1E90D1","#426CB2","#28468E","#082E5E"].entries()) it(`chart ${index+1} follows light-to-dark order`, () => {
    expect(luminance(resolve(root,`chart-${index+1}`))).toBeCloseTo(luminance(hex),6);
  });
  it("retains artwork grey but uses accessible text companions", () => {
    expect(contrast("#939598","#FFFFFF")).toBeLessThan(4.5);
    expect(contrast("#62666C","#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
  it("uses near-black, not white or navy, on accent blue", () => {
    expect(contrast("#080909","#1E90D1")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#FFFFFF","#1E90D1")).toBeLessThan(4.5);
    expect(contrast("#082E5E","#1E90D1")).toBeLessThan(4.5);
  });
});
