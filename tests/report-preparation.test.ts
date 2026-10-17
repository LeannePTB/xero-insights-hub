import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/xero/api.server', () => ({ getConnectionByTenant: async () => ({}), xeroGet: async () => ({}) }));
vi.mock('../src/lib/reports/chart-history.server', () => ({ loadReportCharts: async () => ({ cash: [], profit: [] }) }));
vi.mock('../src/lib/health/health-checks.server', () => ({ loadHealthChecks: async () => new Map([[client, { source: { mode: 'stored' }, tenantId: 'synthetic', fyLabel: 'FY26–27 TO DATE' }]]) }));
import { computeMonthlyReport } from '../src/lib/reports/monthly-report.server';

const client = 'aaaaaaaa-1111-4111-8111-111111111111';
const org = '11111111-1111-4111-8111-111111111111';
const owner = '99999999-1111-4111-8111-111111111111';
const staff = '99999999-2222-4222-8222-222222222222';
const business = '99999999-3333-4333-8333-333333333333';
const viewer = '99999999-4444-4444-8444-444444444444';
const report = 'c0000008-1111-4111-8111-111111111111';
let db: PGlite;
async function asUser<T>(uid: string, fn: () => Promise<T>) {
  await db.exec('begin');
  await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: uid, role: 'authenticated', aal: 'aal2', session_id: uid })]);
  await db.exec('set local role authenticated');
  try { const value = await fn(); await db.exec('commit'); return value; }
  catch (e) { await db.exec('rollback'); throw e; }
}
const save = (id: string | null, period = '2026-09-30') => db.query('select public.save_report_video($1,$2,$3,$4,$5,$6)', [client, period, id, 'https://www.loom.com/share/1234567890abcdef', 'September', 'Your monthly update']);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync('tests/fixtures/rls-schema.sql','utf8'));
  await db.exec(`
    create unique index pending_video_key on public.client_report_pending_videos(client_id,period_end);
    insert into auth.users(id,email) values ('${owner}','owner@example.invalid'),('${staff}','staff@example.invalid'),('${business}','business@example.invalid'),('${viewer}','viewer@example.invalid');
    insert into auth.sessions(id,user_id,created_at) select id,id,now() from auth.users;
    insert into public.firms(id,name,owner_user_id) values('${org}','Synthetic organisation','${owner}');
    insert into public.firm_members(id,firm_id,user_id,role,status) values(gen_random_uuid(),'${org}','${owner}','owner','active'),(gen_random_uuid(),'${org}','${staff}','staff','active');
    insert into public.clients(id,name,firm_id,owner_user_id) values('${client}','Synthetic client','${org}','${owner}');
    insert into public.client_access(id,client_id,user_id,relationship,tier) values(gen_random_uuid(),'${client}','${business}','business_owner','basic'),(gen_random_uuid(),'${client}','${viewer}','external_adviser','basic');
  `);
},60_000);
afterAll(async () => { await db?.close(); });

describe('owner-approved report video preparation', () => {
  it('Staff saves before generation and the draft receives the pending video', async () => {
    await asUser(staff, () => save(null));
    await db.query(`insert into public.client_reports(id,client_id,firm_id,report_key,period_end,status,version,payload,generated_at) values($1,$2,$3,'monthly_management','2026-09-30','draft',1,'{}',now())`,[report,client,org]);
    const r = await db.query<{video_url:string}>(`select video_url from public.client_reports where id=$1`,[report]);
    expect(r.rows[0]?.video_url).toBe('https://www.loom.com/share/1234567890abcdef');
  });
  it('Staff edits after generation and writes metadata-only audit atomically', async () => {
    await asUser(staff, () => db.query('select public.save_report_video($1,$2,$3,$4,$5,$6)', [client,'2026-09-30',report,'https://www.loom.com/share/abcdef1234567890','Updated','New message']));
    const r = await db.query<{video_heading:string}>(`select video_heading from public.client_reports where id=$1`,[report]);
    expect(r.rows[0]?.video_heading).toBe('Updated');
    const audit = await db.query<{meta:Record<string,unknown>}>(`select meta from public.audit_log where action='client_report_video_set' and actor_user_id=$1`,[staff]);
    expect(audit.rows.length).toBe(2);
    expect(JSON.stringify(audit.rows)).not.toContain('loom.com');
  });
  for (const [name, uid] of [['Business Owner',business],['Viewer',viewer]]) {
    it(`${name} cannot read pending video or set it before/after generation`, async () => {
      await expect(asUser(uid, () => save(null))).rejects.toThrow();
      await expect(asUser(uid, () => save(report))).rejects.toThrow();
      const rows = await asUser(uid, () => db.query(`select * from public.client_report_pending_videos`));
      expect(rows.rows).toHaveLength(0);
    });
  }
  it('a different period never receives the September video', async () => {
    const r = await asUser(staff, () => db.query<{v:unknown}>(`select public.get_pending_report_video($1,'2026-08-31') v`,[client]));
    expect(r.rows[0]?.v).toEqual({});
  });
  it('finalised video is locked but a new version carries the current message', async () => {
    await db.query(`update public.client_reports set status='final' where id=$1`,[report]);
    await expect(asUser(staff, () => save(report))).rejects.toThrow('locked');
    await expect(db.query(`update public.client_reports set video_message='Changed' where id=$1`,[report])).rejects.toThrow('locked');
    await db.exec(`insert into public.client_reports(id,client_id,firm_id,report_key,period_end,status,version,payload,generated_at) values(gen_random_uuid(),'${client}','${org}','monthly_management','2026-09-30','draft',2,'{}',now());`);
    const r = await db.query<{video_message:string}>(`select video_message from public.client_reports where client_id=$1 and version=2`,[client]);
    expect(r.rows[0]?.video_message).toBe('New message');
  });
});

describe('Message to client (owner decision 17 Oct)', () => {
  const p2 = '2026-10-31';
  const saveAs = (uid: string, url: string | null, heading: string | null, message: string | null, id: string | null = null) =>
    asUser(uid, () => db.query('select public.save_report_video($1,$2,$3,$4,$5,$6)', [client, p2, id, url, heading, message]));
  const pending = () => db.query<any>(`select video_url, video_heading, video_message from public.client_report_pending_videos where client_id=$1 and period_end=$2`, [client, p2]);
  it('a message without a video is kept and reaches the draft', async () => {
    await saveAs(owner, null, 'October', 'Line one\nLine two');
    expect((await pending()).rows[0]).toEqual({ video_url: null, video_heading: 'October', video_message: 'Line one\nLine two' });
    await db.exec(`insert into public.client_reports(id,client_id,firm_id,report_key,period_end,status,version,payload,generated_at) values('c0000009-1111-4111-8111-111111111111','${client}','${org}','monthly_management','${p2}','draft',1,'{}',now())`);
    const r = await db.query<any>(`select video_message, video_set_by from public.client_reports where id='c0000009-1111-4111-8111-111111111111'`);
    expect(r.rows[0]?.video_message).toBe('Line one\nLine two');
    expect(r.rows[0]?.video_set_by).toBe(owner);
  });
  it('allows a message up to 2,000 characters and refuses longer', async () => {
    await saveAs(staff, null, null, 'x'.repeat(2000));
    await expect(saveAs(staff, null, null, 'x'.repeat(2001))).rejects.toThrow();
  });
  it('video only works', async () => {
    await saveAs(staff, 'https://www.loom.com/share/1234567890abcdef', null, null);
    expect((await pending()).rows[0]).toEqual({ video_url: 'https://www.loom.com/share/1234567890abcdef', video_heading: null, video_message: null });
  });
  it('all three empty clears it and audits as cleared', async () => {
    await saveAs(staff, '', ' ', '');
    expect((await pending()).rows[0]).toEqual({ video_url: null, video_heading: null, video_message: null });
    const a = await db.query(`select 1 from public.audit_log where action='client_report_video_cleared' and actor_user_id=$1`, [staff]);
    expect(a.rows.length).toBe(1);
  });
  it('is locked once finalised', async () => {
    await db.query(`update public.client_reports set status='final' where id='c0000009-1111-4111-8111-111111111111'`);
    await expect(saveAs(staff, null, null, 'Late', 'c0000009-1111-4111-8111-111111111111')).rejects.toThrow('locked');
  });
  it('Business Owner and Viewer cannot edit', async () => {
    await expect(saveAs(business, null, null, 'Mine')).rejects.toThrow();
    await expect(saveAs(viewer, null, null, 'Mine')).rejects.toThrow();
  });
});

describe('Notes retired', () => {
  it('new drafts never read client_notes', async () => {
    const sb = {rpc:async () => ({data:['notes'],error:null}),from:(table:string) => {
      if(table==='client_notes') throw new Error('Notes must not be read');
      return {select:async () => ({data:[],error:null})} as any;
    }};
    const payload = await computeMonthlyReport({supabase:sb,userId:staff,clientId:client,tenantId:'synthetic',tenantName:'Synthetic file',clientName:'Synthetic client',organisationName:'Synthetic organisation',periodEnd:'2026-09-30',currency:'AUD'});
    expect(payload.notes ?? null).toBeNull();
  });
  it('an old finalised report keeps its notes snapshot', async () => {
    await db.query(`update public.client_reports set payload=$1 where id=$2`,[JSON.stringify({notes:[{body:'Included original note'}]}),report]);
    const stored = await asUser(business, () => db.query<{payload:{notes:Array<{body:string}>}}>(`select payload from public.client_reports where id=$1`,[report]));
    expect(stored.rows[0]?.payload.notes.map(n=>n.body)).toEqual(['Included original note']);
  });
  it('nobody signed in can write notes any more', async () => {
    await expect(asUser(owner, () => db.query(`insert into public.client_notes(client_id, body) values($1,'x')`,[client]))).rejects.toThrow();
  });
  it('the Notes card is not in the catalogue lists', async () => {
    const { ALL_WIDGETS, DEFAULT_CARD_ORDER } = await import('../src/lib/tiers');
    const { STANDARD_ORDER } = await import('../src/components/dashboard/dashboard-card-layout');
    expect(ALL_WIDGETS).not.toContain('notes');
    expect(DEFAULT_CARD_ORDER).not.toContain('notes');
    expect(STANDARD_ORDER).not.toContain('notes');
  });
});

describe('Business Health in new report drafts', () => {
  for (const released of [false, true]) {
    it(`includes the section only when released=${released}`, async () => {
      const sb = {
        rpc: async (name: string) => ({ data: name === 'business_health_released' ? released : ['verdict'], error: null }),
        from: () => ({ select: async () => ({ data: [], error: null }) }),
      };
      const payload = await computeMonthlyReport({supabase:sb,userId:staff,clientId:client,tenantId:'synthetic',tenantName:'Synthetic file',clientName:'Synthetic client',organisationName:'Synthetic organisation',periodEnd:'2026-09-30',currency:'AUD'});
      expect(payload.includedSections.includes('verdict')).toBe(released);
      expect(payload.healthChecks !== null).toBe(released);
    });
  }
});