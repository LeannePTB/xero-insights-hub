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
    expect(readFileSync('src/routes/_authenticated/clients.$clientId.reports.tsx', 'utf8')).toContain('<NotesCard');
  });
});
