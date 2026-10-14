import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { requireAal2 } from '@/lib/auth/require-aal2';
import { websiteSettingsSchema, EMPTY_WEBSITE_SETTINGS } from './website-settings';
import { EMPTY_CATALOGUE, type CardCatalogue } from './cards/catalogue';

function publicCatalogue(raw: any): CardCatalogue {
 const modules = Array.isArray(raw?.modules) ? raw.modules : []; const cards = Array.isArray(raw?.cards) ? raw.cards : [];
 return { modules: modules.map((m: any) => ({ key: String(m.key), label: String(m.label), description: String(m.description ?? '') })), cards: cards.filter((c: any) => ['standard','advisory','consolidation'].includes(c.package)).map((c: any, i: number) => ({ key: String(i), package: c.package, module: c.module ?? null, label: String(c.label), description: String(c.description ?? '') })) };
}
export const getPublicWebsiteSettings = createServerFn({method:'GET'}).handler(async () => {
 const url=process.env['SUPABASE_URL']; const key=process.env['SUPABASE_PUBLISHABLE_KEY'];
 if (!url || !key) return { ...EMPTY_WEBSITE_SETTINGS, packages: EMPTY_CATALOGUE, comingSoon: [] as {name:string;description:string;timing:string|null}[] };
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers); if(key.startsWith('sb_') && h.get('Authorization')===`Bearer ${key}`) h.delete('Authorization'); h.set('apikey',key); return fetch(input,{...init,headers:h});}}});
 const {data,error}=await client.rpc('get_public_website_settings');
 if(error) throw new Error('Website settings are unavailable');
 const { packages, ...rest } = (data ?? {}) as Record<string, unknown>;
 // Website-ticked Coming soon entries only: display fields, no keys or links.
 const cs=await client.rpc('public_coming_soon');
 const comingSoon=((cs.error?[]:cs.data)??[] as any[]).map((r:any)=>({name:String(r.name),description:String(r.description??''),timing:r.timing?String(r.timing):null}));
 return { ...websiteSettingsSchema.parse(rest), packages: publicCatalogue(packages), comingSoon };
});
export const savePublicWebsiteSettings = createServerFn({method:'POST'}).middleware([requireAal2]).inputValidator((d:unknown)=>websiteSettingsSchema.parse(d)).handler(async({data,context})=>{
 const {error}=await context.supabase.rpc('save_public_website_settings',{_settings:data});
 if(error) throw new Error('Website settings could not be saved');
 return {ok:true};
});
