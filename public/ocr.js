// OCR runs in a hidden page (iframe) that we throw away every FRAME_LIFE pictures. Throwing it away frees all its memory,
// which on a 2 GB test machine was the only thing that kept the browser from running out of memory. A crash or hang also just reloads it.
const FRAME_LIFE=4,TIMEOUT=180000;let frame=null,used=0,seq=0;const waiting=new Map();
addEventListener('message',e=>{const d=e.data||{};if(d.ready&&frame&&e.source===frame.contentWindow&&frame._ready)frame._ready();
  if(d.id&&waiting.has(d.id)){const w=waiting.get(d.id);waiting.delete(d.id);d.error?w.rej(new Error(d.error)):w.res(d.lines)}});
function fresh(){if(frame){frame.remove();frame=null}used=0;
  const f=document.createElement('iframe');f.src='ocr-frame.html?'+Date.now();f.style.cssText='position:absolute;width:0;height:0;border:0;visibility:hidden';
  const ready=new Promise(r=>f._ready=r);document.body.appendChild(f);frame=f;return ready}
async function run(blob){if(!frame||used>=FRAME_LIFE)await fresh();used++;const id=++seq;
  return new Promise((res,rej)=>{const t=setTimeout(()=>{waiting.delete(id);rej(new Error('timeout'))},TIMEOUT);
    waiting.set(id,{res:v=>{clearTimeout(t);res(v)},rej:v=>{clearTimeout(t);rej(v)}});frame.contentWindow.postMessage({id,blob},'*')})}
export async function ocrBlob(blob){
  try{return await run(blob)}catch(e){await fresh();   // one clean retry in a brand new page
    try{return await run(blob)}catch(e2){throw new Error('This picture could not be read (the browser may be low on memory). Try fewer pictures at a time.')}}}
