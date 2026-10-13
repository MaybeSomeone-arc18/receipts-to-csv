// Pulls vendor, date, total and tax out of OCR lines. Pure functions (no DOM) so they can be tested in Node.
// Every field says how sure it is. Nothing here is "read correctly" until a person has checked it.
(function(root){
const AMT=/(?<![\d])(?:\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d])/g;
let MODE='auto';
function amountValue(tok){
  let t=tok.replace(/\s/g,'');
  if(MODE==='dot'){const v=parseFloat(t.replace(/,/g,''));return v}
  if(MODE==='comma'){const v=parseFloat(t.replace(/\./g,'').replace(',','.'));return v}
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
  for(const r of rows){r.parts.sort((a,b)=>a.x0-b.x0);
    for(const p of r.parts)p.text=p.text.replace(/(\d)\s?[:\uFF1A](\d{3})(?!\d)/g,'$1.$2');
    // a thousands group sometimes comes back as two boxes ("33." then "000", or "261 ±" then "333"): glue them
    for(let k=0;k+1<r.parts.length;k++){const a=r.parts[k],b=r.parts[k+1];
      const ma=/^(.*?\d{1,3})\s*([.,±:;'`])\s*$/.exec(a.text),mb=/^[\dOo]{3}$/.test(b.text.trim())&&/\d/.test(b.text);
      if(ma&&mb&&/(^|[^\d])\d{1,3}$/.test(ma[1])&&b.x0-a.x1<a.h*3){const sep=/[.,]/.test(ma[2])?ma[2]:',';a.text=ma[1]+sep+b.text.trim().replace(/[Oo]/g,'0');a.x1=b.x1;a.conf=Math.min(a.conf,b.conf);r.parts.splice(k+1,1);k--}}
r.text=r.parts.map(p=>p.text).join('  ');r.conf=Math.min(...r.parts.map(p=>p.conf));r.y0=Math.min(...r.parts.map(p=>p.y0))}
  return rows;
}
const STRONG=/grand\s*total|total\s*(bayar|amount|due|payable|jumlah|harga|belanja|tagihan)|amount\s*(due|payable)|balance\s*due|jumlah\s*(bayar|tagihan)|net\s*(total|amount)|total\s*rp/i;
const PLAIN=/\btotal\b|\bTL\b|\btot\b|jumlah|\bamount\b/i;
const NOT=/sub\s*-?\s*total|subtotal|total\s*(disc|diskon|discount|tax|pajak|service|item|qty|saving|point|potongan|kembali|change)|disc(ount)?\s*total|tax\s*total|change|kembali|tunai|cash|tender|bayar\s*tunai|\bqty\b|\bitems?\b/i;
const TAXRE=/\b(tax|pajak|ppn|pb\s?[1il]|gst|vat)\b|resto\b/i;
const SERVRE=/\b(service(\s*charge)?|serv\.?|svc|s\/c)\b/i;
const CASHRE=/\b(cash|tunai|tender(ed)?|bayar|paid|card|kartu|debit|credit)\b/i;
const CHGRE=/\b(change|kembali(an)?)\b/i;
const SUBRE=/sub\s*-?\s*total/i;
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
  for(let i=0;i<rows.length;i++){const r=rows[i];if(!TAXRE.test(r.text)||SERVRE.test(r.text)&&!TAXRE.test(r.text)||/total/i.test(r.text)&&!/tax/i.test(r.text))continue;
    const p=pickAmount(rows,i,TAXRE);if(p)return {value:p.a.value,text:p.a.text,conf:p.conf,reasons:[]}}
  return null;
}
function findLabeled(rows,re,skipRe){
  for(let i=0;i<rows.length;i++){const r=rows[i];if(!re.test(r.text)||(skipRe&&skipRe.test(r.text)))continue;
    const p=pickAmount(rows,i,re);if(p)return {value:p.a.value,text:p.a.text,conf:p.conf,reasons:[]}}
  return null;
}
const CUR=[[/\b(rp\.?|idr)\b/i,'IDR'],[/\busd\b|US\$/i,'USD'],[/\beur\b|€/i,'EUR'],[/\bgbp\b|£/i,'GBP'],[/\binr\b|₹|\brs\.?\s?\d/i,'INR'],[/\bsgd\b|S\$/,'SGD'],[/\bmyr\b|\brm\s?\d/i,'MYR'],[/\$/,'USD?']];
function findCurrency(rows){const t=rows.map(r=>r.text).join('\n');
  for(const [re,c] of CUR){if(re.test(t))return {value:c.replace('?',''),text:c,conf:c.endsWith('?')?0.5:0.9,reasons:c.endsWith('?')?['a $ sign was seen, but $ is used by many currencies']:[]}}
  return null}
function findVendor(rows,h){
  const top=rows.filter(r=>r.y0<h*0.33).slice(0,8);
  for(const r of top){const t=r.text.replace(/[^A-Za-z0-9&' .,-]/g,' ').replace(/\s+/g,' ').trim();
    if((t.match(/[A-Za-z]/g)||[]).length<3)continue;
    if(/receipt|invoice|tel|phone|www\.|http|date|table|bill|order|cashier|npwp|jl\.|jalan|street|\bst\b|address|^no\b|struk|nota/i.test(t))continue;
    if(amountsIn(t).length&&t.replace(/[^A-Za-z]/g,'').length<6)continue;
    return {value:t,text:t,conf:r.conf,reasons:['vendor is a guess: first plain text line near the top']}}
  return null;
}
function extract(lines,w,h,opts){
  MODE=(opts&&opts.decimal)||'auto';
  const rows=buildRows(lines);
  const total=findTotal(rows),date=findDate(rows),tax=findTax(rows),vendor=findVendor(rows,h||Math.max(...lines.map(l=>l.y1),1));
  if(total){const SKIP=/cash|change|tunai|kembali|bayar|tender|paid|card|credit|debit|visa|master|disc|qty|\bno\b/i;let big=0;
    rows.forEach((r,i)=>{if(i===total.row||SKIP.test(r.text))return;for(const a of amountsIn(r.text))if(a.value>big)big=a.value});
    if(big>total.value)total.reasons.push('a bigger amount ('+big+') appears elsewhere on the receipt, so the total may be misread')}
  if(total){const tr=rows[total.row];const am=amountsIn(tr.text);
    if(am.length>=2){const allv=new Set();rows.forEach((r,i)=>{if(i!==total.row||true)amountsIn(r.text).forEach(a=>allv.add(a.value))});
      const rest=new Set();rows.forEach((r,i)=>{if(CHGRE.test(r.text)||CASHRE.test(r.text))amountsIn(r.text).forEach(a=>rest.add(a.value))});
      const hit=am.find(x=>am.some(y=>y.value>x.value&&rest.has(y.value-x.value)));
      if(hit&&hit.value!==total.value){total.replacedFrom=total.value;total.value=hit.value;total.text=hit.text;total.reasons=['the total line also showed '+total.replacedFrom+', but '+total.replacedFrom+' minus '+hit.value+' is printed as change, so '+hit.value+' was used: check it']}}}
  if(total){for(const r of rows){if(!(CASHRE.test(r.text)&&/\b(change|kembali(an)?|charge)\b/i.test(r.text)))continue;const am=amountsIn(r.text);if(am.length!==2)continue;
      const hi=Math.max(am[0].value,am[1].value),lo=Math.min(am[0].value,am[1].value),v=hi-lo;
      const printed=rows.some(q=>q!==r&&amountsIn(q.text).some(x=>x.value===v));
      if(printed&&total.value===hi){total.replacedFrom=total.value;total.value=v;total.text=String(v);total.reasons=['the first guess ('+hi+') looks like cash handed over; cash minus change is '+v+' and that is printed on the receipt, so it was used: check it'];break}}}
  const sub=findLabeled(rows,SUBRE),svc=findLabeled(rows,SERVRE,TAXRE),cash=findLabeled(rows,CASHRE,SUBRE),chg=findLabeled(rows,CHGRE),currency=findCurrency(rows);
  // Cross-check: a total is believable when it equals cash minus change, or subtotal + tax + service.
  const exp=[];if(cash&&chg&&cash.value>chg.value)exp.push({v:cash.value-chg.value,how:'cash paid minus change'});
  if(sub&&(tax||svc))exp.push({v:Math.round((sub.value+(tax?tax.value:0)+(svc?svc.value:0))*100)/100,how:'subtotal + tax + service'});
  let check=null;
  {const all=new Set();rows.forEach(r=>amountsIn(r.text).forEach(a=>all.add(a.value)));
    const hit=total&&exp.find(e=>e.v===total.value);
    if(hit){total.verified=hit.how;total.reasons=total.reasons.filter(x=>!/bigger amount/.test(x))}
    else{const alt=exp.find(e=>all.has(e.v));
      if(alt&&total){total.replacedFrom=total.value;total.value=alt.v;total.text=String(alt.v);total.verified=alt.how;total.reasons=['changed from '+total.replacedFrom+' because this amount equals '+alt.how+' and the first guess did not']}
      else if(total&&(tax||svc)&&!hit&&(()=>{const v=Math.round((total.value+(tax?tax.value:0)+(svc?svc.value:0))*100)/100;return v!==total.value&&all.has(v)&&!(sub&&v===sub.value)})()){const v=Math.round((total.value+(tax?tax.value:0)+(svc?svc.value:0))*100)/100;total.replacedFrom=total.value;total.value=v;total.text=String(v);total.reasons=['the first guess ('+total.replacedFrom+') plus the tax/service line equals another printed amount ('+v+'), so that was used: check it']}
      else if(total&&sub&&total.value<sub.value&&exp.length&&exp[exp.length-1].how==='subtotal + tax + service'){const e=exp[exp.length-1];total.replacedFrom=total.value;total.value=e.v;total.text=String(e.v);total.reasons=['the first guess ('+total.replacedFrom+') is smaller than the subtotal, so it was replaced with subtotal + tax + service ('+e.v+'): check it']}
      else if(total&&exp.length)total.reasons.push('does not match '+exp.map(e=>e.how+' ('+e.v+')').join(' or ')+': check the total')}}
  return {vendor,date,total,tax,currency,service:svc,rows:rows.map(r=>r.text)};
}
const api={extract,amountsIn,amountValue,buildRows};
if(typeof module!=='undefined')module.exports=api;else root.Extract=api;
})(typeof window!=='undefined'?window:globalThis);
