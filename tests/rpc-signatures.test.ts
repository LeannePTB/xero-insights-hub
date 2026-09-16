/**
 * Guard: every database function call in `src` must match a real live signature.
 *
 * Why this exists. A migration that adds an argument to a database function
 * cannot be caught by a typecheck — the call crosses into PostgREST as a JSON
 * body, so a stale caller compiles cleanly and then fails in front of whoever
 * clicked the button ("Could not find the function ... in the schema cache").
 * That happened on 16 September 2026, when `set_org_trial` gained `_branding`
 * and the trial button still posted five arguments.
 *
 * How it works. tests/fixtures/rpc-signatures.json is a read-only snapshot of
 * every public function's INPUT argument names, dumped from the live catalogue by
 * scripts/dump-rpc-signatures.sh. This test parses each `.rpc("name", { ... })`
 * call in src and checks the posted keys against that snapshot:
 *   * the function must exist;
 *   * every key posted must be a real argument of one overload;
 *   * every argument without a default must be posted.
 * scripts/check-rpc-signatures.sh proves the snapshot itself still matches live,
 * so the pair covers both halves — stale caller and stale contract.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

type Signature = { name: string; args: string[]; required: number };
const signatures: Signature[] = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/rpc-signatures.json"), "utf8"),
);

const byName = new Map<string, Signature[]>();
for (const s of signatures) {
  byName.set(s.name, [...(byName.get(s.name) ?? []), s]);
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

type CallSite = { file: string; line: number; fn: string; keys: string[]; hasArgs: boolean };

/** Reads the object literal that follows an `.rpc("name",` and lists its top-level keys. */
function parseKeys(text: string, from: number): { keys: string[]; hasArgs: boolean } | null {
  let i = from;
  while (i < text.length && /[\s,]/.test(text[i]!)) i++;
  if (text[i] === ")") return { keys: [], hasArgs: false };
  if (text[i] !== "{") return null; // spread or variable — cannot be read statically
  let depth = 0;
  const keys: string[] = [];
  for (; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return { keys, hasArgs: true };
    } else if (depth === 1) {
      const rest = text.slice(i);
      const m = /^(?:"([A-Za-z_][A-Za-z0-9_]*)"|([A-Za-z_][A-Za-z0-9_]*))\s*:/.exec(rest);
      if (m && /[{,]\s*$/.test(text.slice(Math.max(0, i - 40), i).replace(/[^\S\n]*\n?/g, (s) => s))) {
        // fall through to the simpler check below
      }
      if (m) {
        const prev = text.slice(0, i).replace(/\s+$/, "");
        const prevChar = prev[prev.length - 1];
        if (prevChar === "{" || prevChar === ",") {
          keys.push(m[1] ?? m[2]!);
          i += m[0].length - 1;
        }
      }
    }
  }
  return null;
}

const calls: CallSite[] = [];
const unreadable: string[] = [];
for (const file of sourceFiles(join(ROOT, "src"))) {
  const text = readFileSync(file, "utf8");
  const re = /\.rpc\(\s*"([a-z0-9_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index).split("\n").length;
    const parsed = parseKeys(text, m.index + m[0].length);
    const rel = file.slice(ROOT.length + 1);
    if (!parsed) {
      unreadable.push(`${rel}:${line} ${m[1]}`);
      continue;
    }
    calls.push({ file: rel, line, fn: m[1]!, keys: parsed.keys, hasArgs: parsed.hasArgs });
  }
}

describe("database function calls match the live signatures", () => {
  it("finds the calls to check", () => {
    expect(calls.length).toBeGreaterThan(50);
  });

  it("calls only functions that exist", () => {
    const missing = calls
      .filter((c) => !byName.has(c.fn))
      .map((c) => `${c.file}:${c.line} ${c.fn} is not a public function`);
    expect(missing).toEqual([]);
  });

  it("posts argument names that exist, and every argument that has no default", () => {
    const problems: string[] = [];
    for (const c of calls) {
      const overloads = byName.get(c.fn);
      if (!overloads) continue;
      const fits = overloads.some((s) => {
        const unknown = c.keys.filter((k) => !s.args.includes(k));
        if (unknown.length > 0) return false;
        // Arguments without a default are positionally first in Postgres.
        const mustPost = s.args.slice(0, s.required);
        return mustPost.every((a) => c.keys.includes(a));
      });
      if (!fits) {
        const shapes = overloads
          .map((s) => `(${s.args.join(", ")}) first ${s.required} required`)
          .join(" | ");
        problems.push(
          `${c.file}:${c.line} ${c.fn} posts {${c.keys.join(", ")}} but live takes ${shapes}`,
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it("has no database call whose arguments cannot be read statically", () => {
    // A dynamic argument object would silently escape this guard, so it is not
    // allowed. Build the object inline at the call site instead.
    expect(unreadable).toEqual([]);
  });
});
