import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireAal2 } from '@/lib/auth/require-aal2';
const input = z.object({ tenantId: z.string().min(1).max(100), card: z.enum(['pnl','health','receivables','payables']), basis: z.enum(['cash','accrual']).default('accrual') }).strict();
export const getStandardChartHistory = createServerFn({ method: 'POST' })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => input.parse(i))
  .handler(async ({data, context}) => {
    const {assertWidgetAccess} = await import('@/lib/xero/access.server');
    await assertWidgetAccess(context.supabase, data.tenantId, data.card);
    const db = context.supabase as any;
    const {data: clientId,error: idError} = await db.rpc('client_for_tenant',{_tenant_id:data.tenantId});
    if(idError || !clientId) throw new Error('Chart history is unavailable.');
    const {loadStandardHistory} = await import('./standard.server');
    const result = await loadStandardHistory(db,clientId,data.tenantId,data.card,data.basis);
    const {logClientDataRead} = await import('@/lib/audit.server');
    logClientDataRead({actorUserId:context.userId,clientId,tenantId:data.tenantId,readKey:data.card,source:'snapshot'});
    return result;
  });