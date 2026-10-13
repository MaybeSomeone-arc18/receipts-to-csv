// PP-OCRv5 (Apache-2.0) runs in a worker. A browser never shrinks a worker's memory, but it frees all of it when the worker is thrown away,
// so we dispose and recreate the reader every RECYCLE pictures. (Without this a 2 GB machine ran out of memory after about 5 receipts.)
const RECYCLE=2;let inst=null,n=0;
export async function ocrBlob(blob){
  if(inst&&n>=RECYCLE){await inst.dispose();inst=null}
  if(!inst){const m=await import('./vendor/paddle.js');inst=await m.create();n=0}
  n++;blob=await shrink(blob);const [res]=await inst.predict(blob);const out=[];
  for(const it of res.items){const t=(it.text||'').trim();if(!t||!it.poly||it.poly.length<4)continue;
    const xs=it.poly.map(p=>p[0]),ys=it.poly.map(p=>p[1]);
    out.push({text:t,conf:it.score,x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)})}
  return out}

async function shrink(blob,MAX=1280){const bm=await createImageBitmap(blob);const k=Math.min(1,MAX/Math.max(bm.width,bm.height));
  if(k===1){bm.close();return blob}const c=new OffscreenCanvas(Math.round(bm.width*k),Math.round(bm.height*k));c.getContext('2d').drawImage(bm,0,0,c.width,c.height);bm.close();return c.convertToBlob({type:'image/png'})}
