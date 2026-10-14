import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { PageContainer } from '@/components/PageContainer';
import { FirmPageHeader } from '@/components/firm/FirmPageHeader';
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select';
import { listUpgradeEnquiries,setUpgradeEnquiryStatus,listEnquiryAlerts } from '@/lib/upgrade-enquiries.functions';
export const Route=createFileRoute('/_authenticated/system/enquiries')({staticData:{sitemap:false},head:()=>({meta:[{title:'Advisory enquiries — Traction Advisory'},{name:'description',content:'Manage practice Advisory enquiries.'},{property:'og:title',content:'Advisory enquiries — Traction Advisory'},{property:'og:description',content:'Authorised Advisory enquiry management.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Enquiries});
function Enquiries(){
  const read=useServerFn(listUpgradeEnquiries),save=useServerFn(setUpgradeEnquiryStatus),qc=useQueryClient();
  const q=useQuery({queryKey:['upgrade-enquiries'],queryFn:()=>read(),retry:false});
  const readAlerts=useServerFn(listEnquiryAlerts);
  const alerts=useQuery({queryKey:['upgrade-enquiry-alerts'],queryFn:()=>readAlerts(),retry:false,refetchInterval:15_000});
  const alertOf=(id:string)=>alerts.data?.find(a=>a.enquiry_id===id);
  const [kind,setKind]=useState<'all'|'enquiry'|'interest'>('all');
  const rows=(q.data??[]).filter((e:any)=>kind==='all'||(e.kind??'enquiry')===kind);
  return <PageContainer className="space-y-4"><FirmPageHeader title="Enquiries" actions={<Select value={kind} onValueChange={(v)=>setKind(v as any)}><SelectTrigger className="w-40" aria-label="Filter by type"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="enquiry">Enquiry</SelectItem><SelectItem value="interest">Interest</SelectItem></SelectContent></Select>}/>
    {q.isLoading?<p>Loading enquiries…</p>:q.error?<p className="text-destructive">Enquiries could not be loaded.</p>:!rows.length?<p className="text-muted-foreground">No enquiries yet.</p>:<div className="divide-y divide-border">{rows.map((e:any)=><article key={e.id} className="space-y-3 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">{e.organisation_name}<span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{e.kind==='interest'?'Interest':'Enquiry'}</span></h2><p className="text-xs text-muted-foreground">{e.name} · {e.email} · {new Date(e.created_at).toLocaleDateString('en-AU')}</p><AlertStatus a={alertOf(e.id)}/></div><Select value={e.status} onValueChange={async(status)=>{if(status!=='new'&&status!=='contacted'&&status!=='done')return;try{await save({data:{id:e.id,status}});await qc.invalidateQueries({queryKey:['upgrade-enquiries']});}catch{toast.error('Could not change status.');}}}><SelectTrigger className="w-36" aria-label={`Status for ${e.organisation_name}`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="contacted">Contacted</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select></div><p className="whitespace-pre-wrap text-sm">{e.message}</p><p className="text-xs text-muted-foreground">{e.kind==='interest'?`Coming soon: ${String(e.message).replace(/^Interested in: /,'')}`:`Modules: ${e.module_keys.join(', ')||'Not specified'}`} · {e.client_ids.length} selected clients</p></article>)}</div>}
  </PageContainer>;
}

function AlertStatus({a}:{a?:{status:string;error:string|null}}){
  if(!a) return null;
  const sent=a.status==='sent', failed=['failed','dlq','bounced','suppressed','complained'].includes(a.status)||a.status==='not_sent';
  const label=sent?'Email sent':failed?`Email failed${a.error?` — ${a.error.slice(0,160)}`:''}`:'Email queued';
  return <p className={`mt-1 text-xs ${sent?'text-success':failed?'text-destructive':'text-muted-foreground'}`}>{label}</p>;
}
