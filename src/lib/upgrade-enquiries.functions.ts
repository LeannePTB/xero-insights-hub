import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireAal2 } from '@/lib/auth/require-aal2';
export const enquirySchema=z.object({firmId:z.string().uuid(),name:z.string().trim().min(1).max(100),modules:z.array(z.string().regex(/^[a-z_]+$/)).max(20),clients:z.array(z.string().uuid()).max(100),message:z.string().trim().min(1).max(2000),submissionKey:z.string().uuid()}).strict();
export const getUpgradeEnquiryContext=createServerFn({method:'POST'}).middleware([requireAal2]).inputValidator((i:unknown)=>z.object({firmId:z.string().uuid()}).strict().parse(i)).handler(async({data,context})=>{
  const {data:result,error}=await context.supabase.rpc('upgrade_enquiry_context',{_firm_id:data.firmId});
  if(error) throw new Error('Advisory information is unavailable.');
  return result as {firmId:string;organisation:string;email:string;clients:{id:string;name:string}[];advisory:boolean}|null;
});
export const submitUpgradeEnquiry=createServerFn({method:'POST'}).middleware([requireAal2]).inputValidator((i:unknown)=>enquirySchema.parse(i)).handler(async({data,context})=>{
  const {data:id,error}=await context.supabase.rpc('submit_upgrade_enquiry',{_firm_id:data.firmId,_name:data.name,_module_keys:data.modules,_client_ids:data.clients,_message:data.message,_submission_key:data.submissionKey});
  if(error) throw new Error(error.message.includes('ENQUIRY_LIMIT')?'You can send up to three enquiries per hour. Please try again later.':'Your enquiry could not be saved.');
  // The alert never blocks or fails the saved enquiry.
  let notification:'queued'|'failed'='failed';
  try{ notification=await queueEnquiryAlert(context.supabase,id as string,data.firmId); }catch(e){ console.error('enquiry alert failed',e instanceof Error?e.message:'unknown'); }
  return {id,notification};
});
const MODULE_LABELS:Record<string,string>={cash_flow:'Cash flow',profit:'Profit',tax_compliance:'Tax & compliance'};
export function perthTime(iso:string){return new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Perth',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));}
async function queueEnquiryAlert(supabase:any,enquiryId:string,firmId:string):Promise<'queued'|'failed'>{
  // Caller-scoped reads: the submitter's own enquiry row and their visible client names.
  const {data:e}=await supabase.from('upgrade_enquiries').select('id,name,email,organisation_name,module_keys,client_ids,message,created_at').eq('id',enquiryId).maybeSingle();
  if(!e) return 'failed';
  const {data:ctx}=await supabase.rpc('upgrade_enquiry_context',{_firm_id:firmId});
  const names=new Map(((ctx?.clients??[]) as {id:string;name:string}[]).map(c=>[c.id,c.name]));
  // System context (email queue): read the platform alert address and record the send link.
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const admin=supabaseAdmin as any;
  const {data:b}=await admin.from('platform_branding').select('enquiry_alert_email').eq('id',true).maybeSingle();
  const to=b?.enquiry_alert_email as string|null;
  if(!to){await admin.from('upgrade_enquiries').update({alert_error:'No alert address configured'}).eq('id',enquiryId);return 'failed';}
  const {enqueueAppEmail}=await import('@/lib/email/send.server');
  const r=await enqueueAppEmail({templateName:'enquiry-alert',recipientEmail:to,idempotencyKey:`enquiry-alert-${enquiryId}`,replyTo:e.email,templateData:{
    organisation:e.organisation_name,submitterName:e.name,submitterEmail:e.email,
    modules:(e.module_keys as string[]).map(k=>MODULE_LABELS[k]??k),clients:(e.client_ids as string[]).map(id=>names.get(id)??'Client'),
    message:e.message,submittedAt:perthTime(e.created_at),enquiriesUrl:'https://tractionadvisory.com.au/system/enquiries'}});
  await admin.from('upgrade_enquiries').update({alert_message_id:r.messageId??null,alert_error:r.status==='queued'?null:(r.reason??r.status)}).eq('id',enquiryId);
  return r.status==='queued'?'queued':'failed';
}
export const listEnquiryAlerts=createServerFn({method:'POST'}).middleware([requireAal2]).handler(async({context})=>{
  const {data,error}=await (context.supabase as any).rpc('admin_upgrade_enquiry_alerts');
  if(error) throw new Error('Send status is unavailable.');
  return (data??[]) as {enquiry_id:string;status:string;error:string|null}[];
});
export const getEnquiryAlertEmail=createServerFn({method:'POST'}).middleware([requireAal2]).handler(async({context})=>{
  const {data,error}=await (context.supabase as any).rpc('get_enquiry_alert_email');
  if(error) throw new Error('Forbidden');
  return {email:(data as string|null)??null};
});
export const saveEnquiryAlertEmail=createServerFn({method:'POST'}).middleware([requireAal2]).inputValidator((i:unknown)=>z.object({email:z.string().trim().max(254).email().nullable()}).strict().parse(i)).handler(async({data,context})=>{
  const {error}=await (context.supabase as any).rpc('save_enquiry_alert_email',{_email:data.email});
  if(error) throw new Error(/forbidden|aal2|NO_ACCESS/i.test(error.message)?'Forbidden':'The address could not be saved.');
  return {ok:true};
});
export const sendEnquiryAlertTest=createServerFn({method:'POST'}).middleware([requireAal2]).handler(async({context})=>{
  // Audited System Administrator check returns the configured address.
  const {data:to,error}=await (context.supabase as any).rpc('begin_enquiry_alert_test');
  if(error) throw new Error(/NOT_CONFIGURED/.test(error.message)?'Save an alert address first.':'Forbidden');
  const {enqueueAppEmail}=await import('@/lib/email/send.server');
  const r=await enqueueAppEmail({templateName:'enquiry-alert',recipientEmail:to as string,templateData:{isTest:true,organisation:'Test organisation',submitterName:'Test sender',submitterEmail:'—',message:'Test of the Advisory enquiry alert.',submittedAt:perthTime(new Date().toISOString())}});
  if(r.status!=='queued') throw new Error('The test email could not be queued.');
  return {ok:true};
});
export const listUpgradeEnquiries=createServerFn({method:'POST'}).middleware([requireAal2]).handler(async({context})=>{
  const {data,error}=await context.supabase.rpc('admin_upgrade_enquiries');
  if(error) throw new Error('Enquiries are unavailable.');
  return data;
});
export const setUpgradeEnquiryStatus=createServerFn({method:'POST'}).middleware([requireAal2]).inputValidator((i:unknown)=>z.object({id:z.string().uuid(),status:z.enum(['new','contacted','done'])}).strict().parse(i)).handler(async({data,context})=>{
  const {error}=await context.supabase.rpc('set_upgrade_enquiry_status',{_id:data.id,_status:data.status});
  if(error) throw new Error('The enquiry status could not be changed.');
  return {ok:true};
});
