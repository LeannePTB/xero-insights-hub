// Injection review (14 Sep 2026) — behaviour tests for the two helpers that
// stand between untrusted text and something that executes it: the Loom URL
// validator (an iframe src) and the CSV cell escaper (a spreadsheet formula).
//
// These are the tests that would have caught the findings, so a regression in
// either helper fails `bun run security:check`.

import { describe, expect, it } from "vitest";

import { parseLoomId } from "../src/lib/reports/report-video";
import { csvCell, toCsv } from "../src/lib/csv";

describe("Loom URL validator rejects every hostile shape", () => {
  const rejected: Array<[string, string]> = [
    ["javascript: scheme", "javascript:alert(document.cookie)"],
    ["javascript with a loom-looking tail", "javascript:0//loom.com/share/abcdefghijklmnop"],
    ["data: scheme", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
    ["userinfo trick", "https://loom.com@evil.example/share/abcdefghijklmnop"],
    ["userinfo with password", "https://loom.com:x@evil.example/embed/abcdefghijklmnop"],
    ["lookalike host", "https://loom.com.evil.example/share/abcdefghijklmnop"],
    ["lookalike suffix", "https://notloom.com/share/abcdefghijklmnop"],
    ["homoglyph-ish host", "https://l00m.com/share/abcdefghijklmnop"],
    ["scheme-relative URL", "//loom.com/share/abcdefghijklmnop"],
    ["bare path", "/share/abcdefghijklmnop"],
    ["open redirect on a real loom path", "https://loom.com/share/?next=https://evil.example"],
    ["redirect endpoint on the real host", "https://www.loom.com/redirect?to=https://evil.example"],
    ["file: scheme", "file:///etc/passwd"],
    ["id with a path traversal", "https://www.loom.com/share/../../evil"],
    ["id with a query appended to the segment", "https://www.loom.com/share/abc%2F..%2Fevil"],
    ["id too short", "https://www.loom.com/share/abc"],
    ["id with punctuation", "https://www.loom.com/share/abcdefghijklmnop;evil"],
    ["extra path segment", "https://www.loom.com/share/abcdefghijklmnop/evil"],
    ["empty", ""],
    ["whitespace only", "   "],
  ];

  for (const [label, url] of rejected) {
    it(`rejects ${label}`, () => {
      expect(parseLoomId(url)).toBeNull();
    });
  }

  it("accepts a genuine share link and returns only the id", () => {
    expect(parseLoomId("https://www.loom.com/share/0123456789abcdef")).toBe("0123456789abcdef");
  });

  it("accepts a genuine embed link on a subdomain", () => {
    expect(parseLoomId("https://loom.com/embed/0123456789abcdef/")).toBe("0123456789abcdef");
  });

  it("returns an id that cannot break out of the embed URL it is put into", () => {
    const id = parseLoomId("https://www.loom.com/share/0123456789abcdef")!;
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
    expect(`https://www.loom.com/embed/${id}`).toBe(
      "https://www.loom.com/embed/0123456789abcdef",
    );
  });
});

describe("CSV cell escaper neutralises spreadsheet formulas", () => {
  const dangerous = [
    "=1+1",
    "=HYPERLINK(\"https://evil.example\",\"click\")",
    "=cmd|'/C calc'!A0",
    "+1234",
    "-1+1",
    "@SUM(A1:A9)",
    "\t=1+1",
    "\r=1+1",
  ];

  for (const value of dangerous) {
    it(`prefixes ${JSON.stringify(value)} so a spreadsheet treats it as text`, () => {
      const cell = csvCell(value);
      const inner = cell.startsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell;
      expect(inner.startsWith("'")).toBe(true);
      expect(/^[=+\-@\t\r]/.test(inner)).toBe(false);
    });
  }

  it("leaves ordinary values alone", () => {
    expect(csvCell("Kubik Holdings Pty Ltd")).toBe("Kubik Holdings Pty Ltd");
    expect(csvCell(1234.56)).toBe("1234.56");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes separators and doubles inner quotes so the file cannot be split apart", () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("serialises objects rather than emitting [object Object]", () => {
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });

  it("builds a whole document with the header escaped too", () => {
    expect(toCsv(["=name", "amount"], [["=1+1", 2]])).toBe("'=name,amount\n'=1+1,2");
  });
});
