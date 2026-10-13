// Pulls vendor, date, total and tax out of OCR lines. Pure functions (no DOM) so they can be tested in Node.
// Every field says how sure it is. Nothing here is "read correctly" until a person has checked it.
(function(root){
const AMT=/(?<![\d])(?:\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d])/g;
function amountValue(tok){
  let t=tok.replace(/\s/g,'');
  if(/^\d{1,3}([.,]\d{3})+[.,]\d{1,2}$/.test(t)){const i=Math.max(t.lastIndexOf('.'),t.lastIndexOf(','));return parseFloat(t.slice(0,i).replace(/[.,]/g,'')+'.'+t.slice(i+1))}
  if(/^\d{1,3}([.,]\d{3})+$/.test(t))return parseInt(t.replace(/[.,]/g,''),10);
  if(/^\d+[.,]\d{1,2}$/.test(t))return parseFloat(t.replace(',','.'));
  return parseInt(t,10);
}
function amountsIn(s){const out=[];let m;AMT.lastIndex=0;while((m=AMT.exec(s))){const v=amountValue(m[0]);if(isFinite(v)&&v>0)out.push({text:m[0],value:v,at:m.index})}return out}
function buildRows(lines){
  const L=lines.map((l,i)=>({...l,i,yc:(l.y0+l.y1)/2,h:l.y1-l.y0})).sort((a,b)=>a.yc-b.yc);
  const rows=[];
  for(const l of L){const r=rows[rows.length-1];
    if(r&&Math.abs(l.yc-r.yc)<Math.max(l.h,r.h)*0.55){r.parts.push(l);r.yc=r.parts.reduce((s,p)=>s+p.yc,0)/r.parts.length;r.h=Math.max(r.h,l.h)}
    else rows.push({parts:[l],yc:l.yc,h:l.h})}
  for(const r of rows){r.parts.sort((a,b)=>a.x0-b.x0);r.text=r.parts.map(p=>p.text).join('  ');r.conf=Math.min(...r.parts.map(p=>p.conf));r.y0=Math.min(...r.parts.map(p=>p.y0))}
  return rows;
}
const STRONG=/grand\s*total|total\s*(bayar|amount|due|payable|jumlah|harga|belanja|tagihan)|amount\s*(due|payable)|balance\s*due|jumlah\s*(bayar|tagihan)|net\s*(total|amount)|total\s*rp/i;
const PLAIN=/\btotal\b|\btot\b|jumlah|\bamount\b/i;
const NOT=/sub\s*-?\s*total|subtotal|total\s*(disc|diskon|discount|tax|pajak|service|item|qty|saving|point|potongan|kembali|change)|disc(ount)?\s*total|tax\s*total|change|kembali|tunai|cash|tender|bayar\s*tunai|\bqty\b|\bitems?\b/i;
const TAXRE=/\b(tax|pajak|ppn|pb\s?1|gst|vat|service\s*charge)\b/i;
function pickAmount(rows,ri,labelRe){
  const r=rows[ri];
  // amounts on the same row, to the right of the label text
  const lab=r.text.search(labelRe);let after=r.text;
  const a=amountsIn(r.text).filter(x=>x.at>=Math.max(0,lab));
  if(a.length)return {a:a[a.length-1],from:ri,sameRow:true,conf:r.conf};
  for(let k=1;k<=2&&ri+k<rows.length;k++){const n=rows[ri+k];if(Math.abs(n.yc-r.yc)>r.h*3.2)break;if(NOT.test(n.text)&&!PLAIN.test(n.text))continue;const b=amountsIn(n.text);if(b.length&&!/[A-Za-z]{4,}/.test(n.text.replace(/rp/i,'')))return {a:b[b.length-1],from:ri+k,sameRow:false,conf:Math.min(r.conf,n.conf)}}
  return null;
}
function findTotal(rows){
  const cands=[];
  rows.forEach((r,i)=>{
    if(NOT.test(r.text)&&!STRONG.test(r.text))return;
    const strong=STRONG.test(r.text),plain=PLAIN.test(r.text);if(!strong&&!plain)return;
    const p=pickAmount(rows,i,strong?STRONG:PLAIN);if(!p)return;
    cands.push({row:i,score:(strong?3:2)+(p.sameRow?0.5:0)+i/rows.length*0.4,...p,strong});
  });
  if(cands.length){cands.sort((a,b)=>b.score-a.score);const c=cands[0];
    const reasons=[];if(!c.sameRow)reasons.push('amount was on the line below the word TOTAL');
    if(cands.filter(x=>x.a.value!==c.a.value).length)reasons.push('more than one different TOTAL-like line');
    return {value:c.a.value,text:c.a.text,conf:c.conf,reasons,row:c.row}}
  // no TOTAL word read: fall back to the biggest amount in the lower part of the receipt
  const low=rows.slice(Math.floor(rows.length*0.4));let best=null;
  for(const r of low)for(const x of amountsIn(r.text)){if(!best||x.value>best.a.value)best={a:x,r}}
  if(best)return {value:best.a.value,text:best.a.text,conf:Math.min(best.r.conf,0.6),reasons:['no TOTAL line found: this is just the biggest amount near the bottom'],row:rows.indexOf(best.r)};
  return null;
}
const MON={jan:1,feb:2,mar:3,apr:4,may:5,mei:5,jun:6,jul:7,aug:8,agu:8,agt:8,sep:9,sept:9,oct:10,okt:10,nov:11,dec:12,des:12};
const pad=n=>String(n).padStart(2,'0');
function iso(y,m,d){if(y<100)y+=2000;if(m<1||m>12||d<1||d>31||y<2000||y>2100)return null;return y+'-'+pad(m)+'-'+pad(d)}
function findDate(rows){
  const txt=rows.map(r=>r.text);
  for(let ri=0;ri<txt.length;ri++){const s=txt[ri];let m;
    if((m=s.match(/\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/))){const v=iso(+m[1],+m[2],+m[3]);if(v)return {value:v,text:m[0],conf:rows[ri].conf,reasons:[]}}
    if((m=s.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2}|\d{2})\b/))){const a=+m[1],b=+m[2],y=+m[3];
      const amb=a<=12&&b<=12&&a!==b;const v=iso(y,b>12?a:b,b>12?b:a); // if second part >12 it must be mm/dd
      const dm=a>12?iso(y,b,a):(b>12?iso(y,a,b):iso(y,b,a));
      if(dm)return {value:dm,text:m[0],conf:rows[ri].conf,reasons:amb?['day/month order is a guess (day first)']:[]}}
    if((m=s.match(/\b(\d{1,2})[\s-]*([A-Za-z]{3,4})[a-z]*[\s,.-]*(20\d{2}|\d{2})\b/))&&MON[m[2].toLowerCase()]){const v=iso(+m[3],MON[m[2].toLowerCase()],+m[1]);if(v)return {value:v,text:m[0],conf:rows[ri].conf,reasons:[]}}
    if((m=s.match(/\b([A-Za-z]{3,4})[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/))&&MON[m[1].toLowerCase()]){const v=iso(+m[3],MON[m[1].toLowerCase()],+m[2]);if(v)return {value:v,text:m[0],conf:rows[ri].conf,reasons:[]}}
  }
  return null;
}
function findTax(rows){
  for(let i=0;i<rows.length;i++){const r=rows[i];if(!TAXRE.test(r.text)||/total/i.test(r.text)&&!/tax/i.test(r.text))continue;
    const p=pickAmount(rows,i,TAXRE);if(p)return {value:p.a.value,text:p.a.text,conf:p.conf,reasons:[]}}
  return null;
}
function findVendor(rows,h){
  const top=rows.filter(r=>r.y0<h*0.33).slice(0,8);
  for(const r of top){const t=r.text.replace(/[^A-Za-z0-9&' .,-]/g,' ').replace(/\s+/g,' ').trim();
    if((t.match(/[A-Za-z]/g)||[]).length<3)continue;
    if(/receipt|invoice|tel|phone|www\.|http|date|table|bill|order|cashier|npwp|jl\.|jalan|street|\bst\b|address|^no\b|struk|nota/i.test(t))continue;
    if(amountsIn(t).length&&t.replace(/[^A-Za-z]/g,'').length<6)continue;
    return {value:t,text:t,conf:r.conf,reasons:['vendor is a guess: first plain text line near the top']}}
  return null;
}
function extract(lines,w,h){
  const rows=buildRows(lines);
  const total=findTotal(rows),date=findDate(rows),tax=findTax(rows),vendor=findVendor(rows,h||Math.max(...lines.map(l=>l.y1),1));
  if(total){const SKIP=/cash|change|tunai|kembali|bayar|tender|paid|card|credit|debit|visa|master|disc|qty|\bno\b/i;let big=0;
    rows.forEach((r,i)=>{if(i===total.row||SKIP.test(r.text))return;for(const a of amountsIn(r.text))if(a.value>big)big=a.value});
    if(big>total.value)total.reasons.push('a bigger amount ('+big+') appears elsewhere on the receipt, so the total may be misread')}
  return {vendor,date,total,tax,rows:rows.map(r=>r.text)};
}
const api={extract,amountsIn,amountValue,buildRows};
if(typeof module!=='undefined')module.exports=api;else root.Extract=api;
})(typeof window!=='undefined'?window:globalThis);
