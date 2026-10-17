import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { filterInvoices, hireMonthlyCost, selectAllState, toggleSelectAll, project, breakEvenImpact, monthsAhead } from '../src/lib/scenario/adjustments';

describe('invoice list', () => {
  const inv = [
    { id: 'a', customer_id: 'Ridgeway University' },
    { id: 'b', customer_id: 'City Limousines' },
    { id: 'c', customer_id: 'Ridgeway University' },
    { id: 'd', customer_id: null },
  ];
  it('choosing a customer shows only that customer', () => {
    expect(filterInvoices(inv, 'Ridgeway University').map((i) => i.id)).toEqual(['a', 'c']);
    expect(filterInvoices(inv, 'Unassigned').map((i) => i.id)).toEqual(['d']);
    expect(filterInvoices(inv, '')).toHaveLength(4);
  });
  it('Select all ticks only what the filter shows, and is indeterminate when partial', () => {
    const shown = filterInvoices(inv, 'Ridgeway University').map((i) => i.id);
    const all = toggleSelectAll(shown, new Set());
    expect([...all].sort()).toEqual(['a', 'c']);
    expect(selectAllState(shown, new Set(['a']))).toBe('some');
    expect(selectAllState(shown, all)).toBe('all');
    expect(toggleSelectAll(shown, all).size).toBe(0);
  });
});

describe('hire maths', () => {
  it('salary: A$78,000 + 12% super = A$7,280/month', () => {
    expect(hireMonthlyCost({ pay: 'salary', salary: 78000, superPct: 12, onCostPct: 0 })).toBe(7280);
  });
  it('hourly: A$35 × 38h × 52 / 12 + 12% super + 3% on-cost', () => {
    expect(hireMonthlyCost({ pay: 'hourly', hourlyRate: 35, hoursPerWeek: 38, superPct: 12, onCostPct: 3 })).toBe(6627.83);
  });
  it('a hire from the second month adds to costs only from then, and break-even reads it', () => {
    const base = { revenue: 20000, revenueByCustomer: {}, costs: { fixed: 8000, variable: 2000, cogs: 4000 }, accounts: {} };
    const months = monthsAhead('2026-10', 3);
    const rows = project(base, [{ id: 'h', kind: 'hire', label: 'Mechanic', pay: 'salary', salary: 78000, superPct: 12, onCostPct: 0, start: '2026-11' }], months);
    expect(rows.map((r) => r.scenario.costs)).toEqual([14000, 21280, 21280]);
    expect(breakEvenImpact(base, rows).extraSales).toBe(10400); // 7,280 / 70% margin
  });
});

const client = 'aaaaaaaa-1111-4111-8111-111111111111';
const org = '11111111-1111-4111-8111-111111111111';
const owner = '99999999-1111-4111-8111-111111111111';
const business = '99999999-3333-4333-8333-333333333333';
const viewer = '99999999-4444-4444-8444-444444444444';
let db: PGlite;
async function asUser<T>(uid: string, fn: () => Promise<T>) {
  await db.exec('begin');
  await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: uid, role: 'authenticated', aal: 'aal2', session_id: uid })]);
  await db.exec('set local role authenticated');
  try { const v = await fn(); await db.exec('commit'); return v; } catch (e) { await db.exec('rollback'); throw e; }
}
const payload = { version: 1, month: '2026-10', horizon: 3, openingCash: null, adjustments: [{ id: 'h', kind: 'hire' }], excludedInvoiceIds: ['inv-1'], costBasis: null };
const read = (uid: string) => asUser(uid, () => db.query<any>('select id, name, payload, shared_with_client from public.client_cashflow_scenarios'));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync('tests/fixtures/rls-schema.sql', 'utf8'));
  await db.exec(`
    insert into auth.users(id,email) values ('${owner}','o@example.invalid'),('${business}','b@example.invalid'),('${viewer}','v@example.invalid');
    insert into auth.sessions(id,user_id,created_at) select id,id,now() from auth.users;
    insert into public.firms(id,name,owner_user_id) values('${org}','Synthetic organisation','${owner}');
    insert into public.firm_members(id,firm_id,user_id,role,status) values(gen_random_uuid(),'${org}','${owner}','owner','active');
    insert into public.clients(id,name,firm_id) values('${client}','Synthetic client','${org}');
    insert into public.client_access(id,client_id,user_id,relationship,tier) values(gen_random_uuid(),'${client}','${business}','business_owner','basic'),(gen_random_uuid(),'${client}','${viewer}','external_adviser','basic');
  `);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('saved scenarios', () => {
  let id = '';
  it('round-trips adjustments and exclusions, audited', async () => {
    const r = await asUser(owner, () => db.query<{ id: string }>('select public.save_cashflow_scenario($1,null,$2,$3,null) id', [client, 'Hire 2nd mechanic', JSON.stringify(payload)]));
    id = r.rows[0]!.id;
    const rows = await read(owner);
    expect(rows.rows[0].name).toBe('Hire 2nd mechanic');
    expect(rows.rows[0].payload).toEqual(payload);
    const audit = await db.query(`select 1 from public.audit_log where action='cashflow_scenario_created'`);
    expect(audit.rows).toHaveLength(1);
  });
  it('Business Owner and Viewer cannot save, share or delete', async () => {
    for (const uid of [business, viewer]) {
      await expect(asUser(uid, () => db.query('select public.save_cashflow_scenario($1,null,$2,$3,null)', [client, 'x', JSON.stringify(payload)]))).rejects.toThrow();
      await expect(asUser(uid, () => db.query('select public.set_cashflow_scenario_shared($1,true)', [id]))).rejects.toThrow();
      await expect(asUser(uid, () => db.query('select public.delete_cashflow_scenario($1)', [id]))).rejects.toThrow();
      await expect(asUser(uid, () => db.query(`update public.client_cashflow_scenarios set name='x'`))).rejects.toThrow();
    }
  });
  it('shared flag: hidden from the Business Owner until shared; Viewer never sees it', async () => {
    expect((await read(business)).rows).toHaveLength(0);
    await asUser(owner, () => db.query('select public.set_cashflow_scenario_shared($1,true)', [id]));
    expect((await read(business)).rows).toHaveLength(1);
    expect((await read(viewer)).rows).toHaveLength(0);
    await asUser(owner, () => db.query('select public.set_cashflow_scenario_shared($1,false)', [id]));
    expect((await read(business)).rows).toHaveLength(0);
  });
  it('report picker freezes the table into a new draft only', async () => {
    await asUser(owner, () => db.query('select public.save_cashflow_scenario($1,$2,$3,$4,$5)', [client, id, 'Hire 2nd mechanic', JSON.stringify(payload), JSON.stringify({ kind: 'cashflow_scenario', rows: [{ month: '2026-10', baselineNet: 1, scenarioNet: -1 }] })]));
    await asUser(owner, () => db.query(`select public.set_cashflow_scenario_report($1,'2026-10-31')`, [id]));
    await db.exec(`insert into public.client_reports(id,client_id,firm_id,report_key,period_end,status,version,payload,generated_at) values(gen_random_uuid(),'${client}','${org}','monthly_management','2026-10-31','draft',1,'{}',now())`);
    const r = await db.query<any>(`select id, scenario_snapshot from public.client_reports where client_id=$1`, [client]);
    expect(r.rows[0].scenario_snapshot.name).toBe('Hire 2nd mechanic');
    await db.query(`update public.client_reports set status='final' where id=$1`, [r.rows[0].id]);
    await expect(db.query(`update public.client_reports set scenario_snapshot=null where id=$1`, [r.rows[0].id])).rejects.toThrow('locked');
  });
});
