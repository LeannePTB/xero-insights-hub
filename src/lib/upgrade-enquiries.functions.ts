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
  return {id,notification:'pending_configuration' as const};
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
