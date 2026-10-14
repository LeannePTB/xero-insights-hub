import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { requireAal2 } from '@/lib/auth/require-aal2';
import { websiteSettingsSchema, EMPTY_WEBSITE_SETTINGS } from './website-settings';
export const getPublicWebsiteSettings = createServerFn({method:'GET'}).handler(async () => {
 const url=process.env['SUPABASE_URL']; const key=process.env['SUPABASE_PUBLISHABLE_KEY'];
 if (!url || !key) return EMPTY_WEBSITE_SETTINGS;
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers); if(key.startsWith('sb_') && h.get('Authorization')===`Bearer ${key}`) h.delete('Authorization'); h.set('apikey',key); return fetch(input,{...init,headers:h});}}});
 const {data,error}=await client.rpc('get_public_website_settings');
 if(error) throw new Error('Website settings are unavailable');
 return websiteSettingsSchema.parse(data ?? {});
});
export const savePublicWebsiteSettings = createServerFn({method:'POST'}).middleware([requireAal2]).inputValidator((d:unknown)=>websiteSettingsSchema.parse(d)).handler(async({data,context})=>{
 const {error}=await context.supabase.rpc('save_public_website_settings',{_settings:data});
 if(error) throw new Error('Website settings could not be saved');
 return {ok:true};
});
