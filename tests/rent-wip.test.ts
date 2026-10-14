import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { noNegativeZero } from '../src/components/dashboard/useTenantCurrency';

describe('rent report is work in progress (14 Oct 2026)', () => {
  it('every rent server function applies the single card rule for rental_properties', () => {
    const src = readFileSync('src/lib/rent.functions.ts', 'utf8');
    const bodies = src.split('.handler(async').slice(1);
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) expect(/assertWidgetAccess\(|assertRentCard\(/.test(b.slice(0, 1500))).toBe(true);
  });
  it('the rent widget renders only on the dashboard, behind its own catalogue card', () => {
    const hits = execSync("rg -l 'RentReportWidget' src || true").toString().trim().split('\n').filter(Boolean).sort();
    expect(hits).toEqual(['src/components/dashboard/RentReportWidget.tsx', 'src/routes/_authenticated/clients.$clientId.index.tsx']);
    const dash = readFileSync('src/routes/_authenticated/clients.$clientId.index.tsx', 'utf8');
    expect(dash).toContain('widgets.includes("rental_properties")');
    const src = readFileSync('src/lib/rent.functions.ts', 'utf8');
    expect(src).not.toContain('"tax_obligations"');
  });
});

describe('money formatting', () => {
  it('a value that rounds to zero carries no minus sign', () => {
    expect(Object.is(noNegativeZero(-0), -0)).toBe(false);
    expect(Object.is(noNegativeZero(-0.4), 0)).toBe(true);
    expect(noNegativeZero(-5)).toBe(-5);
  });
});
