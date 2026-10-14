import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { ArrowUpRight, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getCardCatalogue } from '@/lib/card-model.functions';
import { getPublicWebsiteSettings } from '@/lib/website-settings.functions';
import { getUpgradeEnquiryContext, submitUpgradeEnquiry, enquirySchema } from '@/lib/upgrade-enquiries.functions';
export function AdvisoryEnquiry({firmId,compact=false,inline=false,initialModules=[]}:{firmId:string;compact?:boolean;inline?:boolean;initialModules?:string[]}) {
  const [open,setOpen]=useState(inline),[name,setName]=useState(''),[message,setMessage]=useState(''),[modules,setModules]=useState<string[]>(initialModules),[clients,setClients]=useState<string[]>([]),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[key,setKey]=useState(()=>crypto.randomUUID());
  const getContext=useServerFn(getUpgradeEnquiryContext),getCatalogue=useServerFn(getCardCatalogue),getWebsite=useServerFn(getPublicWebsiteSettings),submit=useServerFn(submitUpgradeEnquiry);
  const context=useQuery({queryKey:['upgrade-context',firmId],queryFn:()=>getContext({data:{firmId}}),retry:false,staleTime:0});
  const catalogue=useQuery({queryKey:['card-catalogue'],queryFn:()=>getCatalogue(),enabled:open,retry:false});
  const website=useQuery({queryKey:['public-website-settings'],queryFn:()=>getWebsite(),enabled:open,retry:false});
  if(!context.data) return null;
  const c=context.data;
  if(!compact && !inline && c.advisory) return null;
  const toggle=(id:string,values:string[],set:(v:string[])=>void)=>set(values.includes(id)?values.filter(v=>v!==id):[...values,id]);
  const body=<>
      {catalogue.data?.catalogue.modules.map(m=><section key={m.key} className="space-y-1 border-b border-border pb-3"><h3 className="text-sm font-semibold">{m.label}</h3><p className="text-xs text-muted-foreground">{m.description}</p><ul className="space-y-1 text-xs">{catalogue.data.catalogue.cards.filter(card=>card.package==='advisory'&&card.module===m.key).map(card=><li key={card.key}><strong>{card.label}</strong> — {card.description}</li>)}</ul></section>)}
      {catalogue.error && <p className="text-sm text-destructive">The Advisory catalogue could not be loaded.</p>}
      {saved?<div role="status" className="py-4"><h3 className="font-semibold">Enquiry saved</h3><p className="mt-2 text-sm text-muted-foreground">Your enquiry is available to the System Administrators.</p></div>:<form className="space-y-3" onSubmit={async e=>{e.preventDefault();const parsed=enquirySchema.safeParse({firmId,name,modules,clients,message,submissionKey:key});if(!parsed.success){toast.error(parsed.error.issues[0]?.message??'Check the form.');return;}setBusy(true);try{await submit({data:parsed.data});setSaved(true);}catch(err){toast.error(err instanceof Error?err.message:'Could not save.');}finally{setBusy(false);}}}>
        <h3 className="text-sm font-semibold">Enquire about Advisory</h3>
        <label className="block space-y-1 text-xs">Name<Input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="block space-y-1 text-xs">Email<Input type="email" value={c.email} readOnly/></label>
        <label className="block space-y-1 text-xs">Organisation<Input value={c.organisation} readOnly/></label>
        <fieldset className="space-y-2 text-xs"><legend className="mb-2 font-medium">Modules of interest</legend>{catalogue.data?.catalogue.modules.map(m=><label key={m.key} className="flex items-center gap-2"><Checkbox checked={modules.includes(m.key)} onCheckedChange={()=>toggle(m.key,modules,setModules)}/>{m.label}</label>)}</fieldset>
        {c.clients.length>0 && <fieldset className="space-y-2 text-xs"><legend className="mb-2 font-medium">Clients of interest</legend>{c.clients.map(client=><label key={client.id} className="flex items-center gap-2"><Checkbox checked={clients.includes(client.id)} onCheckedChange={()=>toggle(client.id,clients,setClients)}/>{client.name}</label>)}</fieldset>}
        <label className="block space-y-1 text-xs">Message<Textarea required maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)}/></label>
        <Button type="submit" disabled={busy||!catalogue.data}><Send className="mr-2 h-3.5 w-3.5"/>{busy?'Saving…':'Send enquiry'}</Button>
      </form>}
      {website.data?.calendlyUrl && <Button asChild variant="outline"><a href={website.data.calendlyUrl} target="_blank" rel="noopener noreferrer">Book a call<ArrowUpRight className="ml-2 h-3.5 w-3.5"/></a></Button>}
    </>;
  if(inline) return <div className="space-y-4">{body}</div>;
  return <>
    <div className={compact?'':'my-4 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3'}>
      {!compact && <p className="text-sm font-medium">Unlock Advisory</p>}
      <Button size="sm" variant="outline" onClick={()=>{setOpen(true);setKey(crypto.randomUUID());setSaved(false);}}><ArrowUpRight className="mr-2 h-3.5 w-3.5"/>See what’s in Advisory</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Advisory</DialogTitle><DialogDescription>{c.organisation}</DialogDescription></DialogHeader>{body}</DialogContent></Dialog>
  </>;
}
