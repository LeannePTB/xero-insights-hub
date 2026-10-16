import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getStandardChartHistory } from '@/lib/charts/standard.functions';
import { pnlPoints, financialYear } from '@/lib/charts/standard';
import { VectorChart } from './VectorChart';
/** A trend line needs at least this many stored points before it is drawn. */
export const MIN_TREND_POINTS = 3;
export function StandardHistoryChart({tenantId,card,currency='AUD',basis='accrual'}:{tenantId:string;card:'pnl'|'health'|'receivables'|'payables';currency?:string;basis?:'cash'|'accrual'}) {
  const fetchHistory=useServerFn(getStandardChartHistory);
  const q=useQuery({queryKey:['standard-chart',tenantId,card,basis],queryFn:()=>fetchHistory({data:{tenantId,card,basis}}),staleTime:300000,retry:false});
  if(q.isLoading) return <p className="py-3 text-xs text-muted-foreground">Loading stored chart history…</p>;
  if(q.error||!q.data) return <p className="py-3 text-xs text-muted-foreground">Stored chart history is unavailable.</p>;
  const d=q.data;
  return <div className="min-w-0">
    {card==='pnl' && <>
      <VectorChart title={`Income, expenses and net profit · ${financialYear(d.today).label} to date`} points={pnlPoints(d.pnl,d.today)} series={[{label:'Income',kind:'bar'},{label:'Expenses (including cost of sales)',kind:'bar'},{label:'Net profit',kind:'line'}]} currency={currency}/>
      <dl className="mt-1 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">{[0,1,12].map((offset)=>{
        const date=new Date(d.today+'T00:00:00Z');date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-offset);
        const r=d.pnl.filter(p=>p.date.slice(0,7)===date.toISOString().slice(0,7)).at(-1);
        return <div key={offset} className="border-l-2 border-border pl-3"><dt className="text-muted-foreground">{offset===0?'This month (partial)':offset===1?'Last month':'Same month last year'}</dt><dd className="font-semibold tabular-nums">{r?.profit===null||r?.profit===undefined?'—':new Intl.NumberFormat('en-AU',{style: 'currency', signDisplay: 'negative',currency}).format(r.profit)}</dd></div>;
      })}</dl>
    </>}
    {card==='health' && <><VectorChart title="Cash at bank · last 12 months" points={d.cash.map(p=>({label:p.date,values:[p.value]}))} series={[{label:'Cash at bank',kind:'line'}]} currency={currency}/>{d.cashNote && <p className="pt-1 text-xs text-muted-foreground">{d.cashNote}</p>}<p className="text-xs text-muted-foreground">Health score trend unavailable — historical scores are not stored.</p></>}
    {card==='receivables' && d.overdue.filter(p=>p.value!==null).length<MIN_TREND_POINTS && <p className="py-2 text-xs text-muted-foreground">Trend appears once 3 months are stored.</p>}
    {card==='receivables' && d.overdue.filter(p=>p.value!==null).length>=MIN_TREND_POINTS && <VectorChart title="Total overdue · stored history" points={d.overdue.map(p=>({label:p.date,values:[p.value]}))} series={[{label:'Overdue',kind:'line'}]} currency={currency}/>}
    {(card!=='receivables'||d.overdue.filter(p=>p.value!==null).length>=MIN_TREND_POINTS) && <p className="py-2 text-xs text-muted-foreground">{d.note}</p>}
  </div>;
}