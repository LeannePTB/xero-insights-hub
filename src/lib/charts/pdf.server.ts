import type { jsPDF } from 'jspdf';
import { chartGeometry, type ChartPoint, type ChartSeries } from './geometry';
import { presentation, printRgb } from '@/lib/presentation-tokens';
/** Draw the same geometry as the web, directly as PDF vectors. No network or images. */
export function drawPdfChart(doc: jsPDF, points: ChartPoint[], series: ChartSeries[], x: number, y: number, width: number) {
  const g = chartGeometry(points,series), scale = width / 600;
  const tx = (v:number) => x+v*scale, ty = (v:number) => y+v*scale;
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
  for(const tick of g.ticks) {
    doc.setDrawColor(...printRgb(presentation.border)); doc.line(tx(62),ty(tick.y),tx(580),ty(tick.y));
    doc.setTextColor(...printRgb(presentation.muted)); doc.text(new Intl.NumberFormat('en-AU',{notation:'compact',maximumFractionDigits:1}).format(tick.value),tx(57),ty(tick.y)+2,{align:'right'});
  }
  doc.setDrawColor(...printRgb(presentation.muted));doc.line(tx(62),ty(g.zero),tx(580),ty(g.zero));
  for(const [si,s] of g.series.entries()) {
    const rgb=printRgb([presentation.cyan,presentation.mid,presentation.primary,presentation.text][si%(g.series.length>3?4:3)]);
    doc.setDrawColor(...rgb);doc.setFillColor(...rgb);doc.setLineWidth(1.3);
    for(let i=0;i<s.points.length;i++) {
      const p=s.points[i];if(!p)continue;
      if(s.kind==='bar'||s.kind==='stack') {doc.rect(tx(p.barX),ty(p.barY),p.width*scale,Math.max(p.height*scale,.5),'FD');doc.setDrawColor(...printRgb(presentation.text));doc.line(tx(p.barX),ty(p.y),tx(p.barX+p.width),ty(p.y));doc.setDrawColor(...rgb);}
      else {const prev=s.points[i-1];if(prev)doc.line(tx(prev.x),ty(prev.y),tx(p.x),ty(p.y));doc.circle(tx(p.x),ty(p.y),2,'FD');}
    }
  }
  doc.setTextColor(...printRgb(presentation.muted));
  for(const [i,l] of g.labels.entries()) if(i%2===0 || i===g.labels.length-1)doc.text(l.label,tx(l.x),ty(197),{align:'center'});
  doc.setLineWidth(.4);
  return 210*scale;
}
