import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { mapCatalogue } from '../src/lib/cards/catalogue';

describe('Coming soon interest (owner 14 Oct)', () => {
  const src = readFileSync('src/lib/coming-soon.functions.ts', 'utf8');
  it('records interest through the guarded database function', () => {
    expect(src).toContain('rpc("register_coming_soon_interest"');
  });
  it('queues the existing enquiry alert email to the configured platform address', () => {
    expect(src).toContain('notification = await queueInterestAlert(');
    expect(src).toContain('templateName: "enquiry-alert"');
    expect(src).toContain('select("enquiry_alert_email")');
    expect(src).toContain('replyTo: r.email');
  });
  it('maps the shared hourly limit to the same message as enquiries', () => {
    expect(src).toMatch(/ENQUIRY_LIMIT[\s\S]{0,80}three enquiries per hour/);
  });
});

describe('Notes card retired from the dashboard (owner 14 Oct)', () => {
  it('a retired catalogue card is never mapped into any catalogue', () => {
    const cat = mapCatalogue([], [
      { card_key: 'pnl', package: 'standard', label: 'P&L', status: 'available' },
      { card_key: 'notes', package: 'standard', label: 'Notes', status: 'retired' },
    ]);
    expect(cat.cards.map((c) => c.key)).toEqual(['pnl']);
  });
  it('the live dashboard no longer renders the Notes card; the reports page keeps it', () => {
    expect(readFileSync('src/routes/_authenticated/clients.$clientId.index.tsx', 'utf8')).not.toContain('NotesCard');
    expect(readFileSync('src/routes/_authenticated/clients.$clientId.reports.tsx', 'utf8')).not.toContain('NotesCard');
  });
});

describe('Automatic Coming soon teasers for Work-in-progress cards (owner 15 Oct)', () => {
  const fixture = readFileSync('tests/fixtures/rls-schema.sql', 'utf8');
  it('the teaser builder unions an automatic row for every Work-in-progress card', () => {
    const fn = fixture.slice(fixture.indexOf('app_private.coming_soon_rows'));
    expect(fn).toContain("'auto_' || c.card_key");
    expect(fn).toContain("c.status = 'wip'");
    expect(fn).toContain('not c.hide_from_coming_soon');
  });
  it('an entry linked to the card (edited override, shown or hidden) replaces the automatic teaser', () => {
    const fn = fixture.slice(fixture.indexOf('app_private.coming_soon_rows'));
    expect(fn).toMatch(/not exists \(select 1 from public\.coming_soon_entries e where e\.card_key = c\.card_key\)/);
  });
  it('the public website reader stays manual-only', () => {
    expect(fixture).toContain('show_on_website and app_private.coming_soon_still_coming');
  });
  it('interest can be recorded on an automatic teaser through the same guarded recorder', () => {
    expect(readFileSync('tests/fixtures/rls-schema.sql', 'utf8')).toMatch(/left\(_entry_key, 5\) = 'auto_'/);
  });
  it('the opt-out tick is saved through the audited super-admin function', () => {
    expect(readFileSync('src/lib/card-model.functions.ts', 'utf8')).toContain('rpc("admin_set_card_coming_soon"');
  });
  it('mapCatalogue carries the per-card opt-out and drops retired cards', () => {
    const cat = mapCatalogue([], [
      { card_key: 'cashflow', package: 'advisory', label: 'Cash Flow', status: 'wip', hide_from_coming_soon: true },
      { card_key: 'health', package: 'standard', label: 'Business health', status: 'retired' },
    ]);
    expect(cat.cards.map((c) => c.key)).toEqual(['cashflow']);
    expect(cat.cards[0]!.comingSoonHidden).toBe(true);
  });
});
