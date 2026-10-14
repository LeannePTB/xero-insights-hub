import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { getPublicWebsiteSettings, savePublicWebsiteSettings } from '@/lib/website-settings.functions';
import { EMPTY_WEBSITE_SETTINGS, validateWebsiteFile, WEBSITE_MEDIA_BUCKET, type WebsiteSettings } from '@/lib/website-settings';
export function WebsiteSettingsEditor(){
 const read=useServerFn(getPublicWebsiteSettings); const save=useServerFn(savePublicWebsiteSettings); const qc=useQueryClient();
 const q=useQuery({queryKey:['public-website-settings'],queryFn:()=>read()});
 const [draft,setDraft]=useState<WebsiteSettings|null>(null); const [busy,setBusy]=useState(false);
 const value=draft??q.data??EMPTY_WEBSITE_SETTINGS;
 const update=(key:keyof WebsiteSettings,v:string|null)=>setDraft({...value,[key]:v||null});
 async function upload(file:File|undefined,kind:'hero'|'poster'){
  if(!file)return; setBusy(true);
  try{validateWebsiteFile(file,kind);const ext=kind==='hero'?'mp4':file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp'; const path=`${kind}/${crypto.randomUUID()}.${ext}`;
   const {error}=await supabase.storage.from(WEBSITE_MEDIA_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
   if(error)throw new Error('Public website uploads are not available. A workspace owner must enable public buckets first.');
   update(kind==='hero'?'heroVideoPath':'heroPosterPath',path);toast.success('Uploaded — save website settings to use it.');
  }catch(e){toast.error(e instanceof Error?e.message:'Upload failed');}finally{setBusy(false);}
 }
 return <section className="space-y-4 border-t border-border pt-6"><h2>Website</h2>
 <p className="text-sm text-muted-foreground">Public media needs the website-media bucket. If workspace policy blocks public buckets, an owner/admin must enable them in Settings → Privacy & Security; the static preview stays in use until uploads are available.</p>
 {q.isError&&<p role="alert" className="text-destructive">Website settings could not be loaded.</p>}
 {(['calendlyUrl','walkthroughUrl','standardPrice','advisoryPrice','consolidationPrice','whiteLabelPrice'] as const).map(key=><div className="space-y-2" key={key}><Label htmlFor={key}>{({calendlyUrl:'Calendly booking URL',walkthroughUrl:'Walkthrough video URL (Loom or YouTube)',standardPrice:'Standard price (optional)',advisoryPrice:'Advisory price (optional)',consolidationPrice:'Consolidation price (optional)',whiteLabelPrice:'White label price (optional)'})[key]}</Label><Input id={key} value={value[key]??''} maxLength={key.endsWith('Price')?80:500} onChange={e=>update(key,e.target.value)}/></div>)}
 {(['hero','poster'] as const).map(kind=><div key={kind} className="space-y-2"><Label htmlFor={`website-${kind}`}>{kind==='hero'?'Hero video — MP4, up to 25 MB':'Poster — PNG, JPG or WebP, up to 2 MB'}</Label><Input id={`website-${kind}`} type="file" accept={kind==='hero'?'video/mp4':'image/png,image/jpeg,image/webp'} disabled={busy} onChange={e=>upload(e.target.files?.[0],kind)}/>{value[kind==='hero'?'heroVideoPath':'heroPosterPath']&&<Button variant="ghost" onClick={()=>update(kind==='hero'?'heroVideoPath':'heroPosterPath',null)}>Remove {kind}</Button>}</div>)}
 <Button disabled={busy||q.isPending||q.isError} onClick={async()=>{setBusy(true);try{await save({data:value});await qc.invalidateQueries({queryKey:['public-website-settings']});setDraft(null);toast.success('Website settings saved');}catch{toast.error('Check the URLs and try again. Website settings could not be saved.');}finally{setBusy(false);}}}>{busy?'Saving…':'Save website settings'}</Button>
 </section>;
}
