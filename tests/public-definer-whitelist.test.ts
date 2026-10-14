import { describe, it, expect } from 'vitest';

// The two anon-callable definer functions excluded from the aal2 guard check
// must only ever return whitelisted public website fields.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const live = url && key ? describe : describe.skip;

async function rpc(name: string) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key!, 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(res.ok).toBe(true);
  return res.json();
}

const FORBIDDEN = /("id"|_id"|email|firm|client|tenant|user|owner|@)/i;

live('public definer functions return only public fields', () => {
  it('get_public_website_settings returns the whitelist', async () => {
    const s = await rpc('get_public_website_settings');
    const allowed = ['calendlyUrl', 'heroVideoPath', 'heroPosterPath', 'walkthroughUrl', 'standardPrice', 'advisoryPrice', 'consolidationPrice', 'whiteLabelPrice', 'packages'];
    for (const k of Object.keys(s)) expect(allowed).toContain(k);
    expect(Object.keys(s.packages).sort()).toEqual(['cards', 'modules']);
    for (const m of s.packages.modules) expect(Object.keys(m).sort()).toEqual(['description', 'key', 'label']);
    for (const c of s.packages.cards) expect(Object.keys(c).sort()).toEqual(['description', 'label', 'module', 'package']);
    expect(JSON.stringify(Object.keys(s))).not.toMatch(FORBIDDEN);
  });

  it('public_coming_soon returns name, description and timing only', async () => {
    const rows = await rpc('public_coming_soon');
    expect(Array.isArray(rows)).toBe(true);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(['description', 'name', 'timing']);
      expect(JSON.stringify(r)).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/);
    }
  });
});
