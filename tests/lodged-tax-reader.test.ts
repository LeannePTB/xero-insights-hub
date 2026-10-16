import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ gate: vi.fn(), snapshot: vi.fn() }));
vi.mock('../src/lib/xero/access.server', () => ({ assertWidgetAccess: mocks.gate }));
vi.mock('../src/lib/xero/snapshot-read.server', () => ({ readSnapshot: mocks.snapshot }));
import { readLodgedTaxBills } from '../src/lib/xero/lodged-tax.server';
beforeEach(() => vi.clearAllMocks());
const tenantId = '297a370f-81ae-4aeb-b289-ec5c5043ac09';
it('reads only the resolved client through the caller after the requested card gate', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: 'resolved-client', error: null });
  const supabase = { rpc };
  mocks.snapshot.mockResolvedValue({ payload: { Invoices: [{ Contact: { Name: 'Australian Taxation Office' }, InvoiceNumber: 'Sept BAS', AmountDue: 3000, Total: 4742, DueDateString: '2026-10-21' }] }, source: { complete: true } });
  const result = await readLodgedTaxBills(supabase, tenantId, 'tax_obligations');
  expect(mocks.gate).toHaveBeenCalledWith(supabase, tenantId, 'tax_obligations');
  expect(rpc).toHaveBeenCalledWith('client_for_tenant', { _tenant_id: tenantId });
  expect(mocks.snapshot).toHaveBeenCalledWith({ supabase, tenantId, clientId: 'resolved-client', reportKey: 'invoices_accpay_open' });
  expect(result.bills[0]).toMatchObject({ amount: 3000, total: 4742 });
});
it('a refused card gate performs no client or snapshot read', async () => {
  mocks.gate.mockRejectedValueOnce(new Error('denied'));
  const rpc = vi.fn();
  await expect(readLodgedTaxBills({ rpc }, tenantId, 'payg_withholding')).rejects.toThrow('denied');
  expect(rpc).not.toHaveBeenCalled();
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
it('an unresolved client fails closed without fetching snapshots', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  await expect(readLodgedTaxBills({ rpc }, tenantId, 'tax_obligations')).rejects.toThrow('Unable to read tax bills');
  expect(mocks.snapshot).not.toHaveBeenCalled();
});