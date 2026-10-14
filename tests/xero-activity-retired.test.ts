import { expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { ALL_WIDGETS, DEFAULT_CARD_ORDER } from '../src/lib/tiers';
import { snapshotReports } from '../src/lib/xero/snapshot-keys';
it('never offers or schedules the retired Xero activity card', () => {
  expect(ALL_WIDGETS).not.toContain('xero_activity');
  expect(DEFAULT_CARD_ORDER).not.toContain('xero_activity');
  expect(readFileSync('tests/fixtures/card-catalogue.sql', 'utf8')).not.toContain("'xero_activity'");
  expect(existsSync('src/lib/xero/user-activity.functions.ts')).toBe(false);
  expect(existsSync('src/components/dashboard/XeroActivityWidget.tsx')).toBe(false);
  expect(snapshotReports('2026-10-14').some(r => r.path === 'UserActivities')).toBe(false);
});