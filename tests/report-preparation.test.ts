import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/xero/api.server', () => ({ getConnectionByTenant: async () => ({}), xeroGet: async () => ({}) }));
vi.mock('../src/lib/reports/chart-history.server', () => ({ loadReportCharts: async () => ({ cash: [], profit: [] }) }));
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

describe('unchanged notes snapshot at generation', () => {
  it('only ticked notes are captured, later edits/deletes leave a final report visible to its Business Owner unchanged', async () => {
    const source = [
      {body:'Included original note',author_id:null,created_at:'2026-01-01T00:00:00Z',include_in_report:true},
      {body:'Internal only',author_id:null,created_at:'2026-09-01T00:00:00Z',include_in_report:false},
    ];
    const filters: Array<[string,unknown]> = [];
    const sb = {rpc:async () => ({data:['notes'],error:null}),from:(table:string) => {
      if(table==='card_catalogue'||table==='card_modules'){const c:any={select:async () => ({data:[],error:null})};return c;}
      if(table!=='client_notes') throw new Error('Unexpected read');
      const q:any={select:() => q,eq:(key:string,value:unknown) => {filters.push([key,value]);return q;},order:async () => ({data:source.filter(n=>n.include_in_report),error:null})};return q;
    }};
    const payload = await computeMonthlyReport({supabase:sb,userId:staff,clientId:client,tenantId:'synthetic',tenantName:'Synthetic file',clientName:'Synthetic client',organisationName:'Synthetic organisation',periodEnd:'2026-09-30',currency:'AUD'});
    expect(filters).toContainEqual(['include_in_report',true]);
    expect(payload.notes?.map(n=>n.body)).toEqual(['Included original note']);
    await db.query(`update public.client_reports set payload=$1 where id=$2`,[JSON.stringify(payload),report]);
    source[0].body='Edited later'; source.splice(0,1);
    const stored = await asUser(business, () => db.query<{payload:{notes:Array<{body:string}>}}>(`select payload from public.client_reports where id=$1`,[report]));
    expect(stored.rows[0]?.payload.notes.map(n=>n.body)).toEqual(['Included original note']);
    expect(payload.notes?.[0]?.body).toBe('Included original note');
    const notes = await asUser(business, () => db.query(`select * from public.client_notes where client_id=$1`,[client]));
    expect(notes.rows).toHaveLength(0);
  });
});