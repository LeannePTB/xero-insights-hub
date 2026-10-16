import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ gate: vi.fn(), snapshot: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder: any = { middleware: () => builder, inputValidator: () => builder, handler: (fn: any) => fn };
  return builder;
} }));
vi.mock('../src/lib/auth/require-aal2', () => ({ requireAal2: {} }));
vi.mock('../src/lib/xero/access.server', () => ({ assertWidgetAccess: mocks.gate }));
vi.mock('../src/lib/xero/snapshot-read.server', () => ({ readSnapshot: mocks.snapshot }));
import { getLodgedTaxBills } from '../src/lib/xero/lodged-tax.functions';
beforeEach(() => vi.clearAllMocks());
const tenantId = '297a370f-81ae-4aeb-b289-ec5c5043ac09';
it('reads only the resolved client through the caller after the requested card gate', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: 'resolved-client', error: null });
  const supabase = { rpc };
  mocks.snapshot.mockResolvedValue({ payload: { Invoices: [{ Contact: { Name: 'Australian Taxation Office' }, InvoiceNumber: 'Sept BAS', AmountDue: 3000, Total: 4742, DueDateString: '2026-10-21' }] }, source: { complete: true } });
  const result = await (getLodgedTaxBills as any)({ data: { tenantId, widget: 'tax_obligations' }, context: { supabase } });
  expect(mocks.gate).toHaveBeenCalledWith(supabase, tenantId, 'tax_obligations');
  expect(rpc).toHaveBeenCalledWith('client_for_tenant', { _tenant_id: tenantId });
  expect(mocks.snapshot).toHaveBeenCalledWith({ supabase, tenantId, clientId: 'resolved-client', reportKey: 'invoices_accpay_open' });
  expect(result.bills[0]).toMatchObject({ amount: 3000, total: 4742 });
});
it('a refused card gate performs no client or snapshot read', async () => {
  mocks.gate.mockRejectedValueOnce(new Error('denied'));
  const rpc = vi.fn();
  await expect((getLodgedTaxBills as any)({ data: { tenantId, widget: 'payg_withholding' }, context: { supabase: { rpc } } })).rejects.toThrow('denied');
  expect(rpc).not.toHaveBeenCalled();
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
it('an unresolved client fails closed without fetching snapshots', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  await expect((getLodgedTaxBills as any)({ data: { tenantId, widget: 'tax_obligations' }, context: { supabase: { rpc } } })).rejects.toThrow('Unable to read tax bills');
  expect(mocks.snapshot).not.toHaveBeenCalled();
});