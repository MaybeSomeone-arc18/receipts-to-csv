// Tiny local static server (localhost only). Nothing is uploaded anywhere: OCR runs in your browser.
const http=require('http'),fs=require('fs'),path=require('path');
const PUB=path.join(__dirname,'public'),PORT=+process.env.PORT||8777;
const T={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.tar':'application/x-tar'};
const okHost=h=>/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h||'');
http.createServer((req,res)=>{
 if(!okHost(req.headers.host)){res.statusCode=403;return res.end('bad host')}
 const u=new URL(req.url,'http://x');let p=path.normalize(path.join(PUB,u.pathname==='/'?'index.html':u.pathname));
 if(!p.startsWith(PUB+path.sep)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.statusCode=404;return res.end('not found')}
 res.setHeader('content-type',T[path.extname(p)]||'application/octet-stream');res.setHeader('cross-origin-resource-policy','same-origin');fs.createReadStream(p).pipe(res)
}).listen(PORT,'127.0.0.1',()=>console.log('http://localhost:'+PORT));
