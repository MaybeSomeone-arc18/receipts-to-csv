// Regression check on 12 receipts the old (v2) rules got wrong. It needs OCR output files that are NOT in this repo
// (test/train_raw.json and test/val_raw.json), made locally with test/dump.js from the CORD v2 train and validation
// splits (https://huggingface.co/datasets/naver-clova-ix/cord-v2, CC BY 4.0). No dataset images or OCR text are redistributed here.
// train rows are t000.. in dataset order; validation rows are v000.. in dataset order.
// Two receipts are KNOWN FAILURES with the current rules and are listed as such, not hidden.
const {extract}=require('../public/extract.js'),fs=require('fs');
const want={t043:60999,t065:650100,t059:25000,t005:261333,t013:247775,t076:33000,t025:14000,t088:50039,v020:16500,v024:80500};
const known_fail={t050:33000,v004:41000};
const files={t:'train_raw.json',v:'val_raw.json'};let ok=0,n=0,unexpected=0,kf=0;
for(const [id,truth] of Object.entries({...want,...known_fail})){const f=__dirname+'/'+files[id[0]];
 if(!fs.existsSync(f)){console.log('missing',f,'- build it with test/dump.js first');process.exit(2)}
 const r=JSON.parse(fs.readFileSync(f))[id];const e=extract(r.lines,r.w,r.h);const g=e.total&&e.total.value,hit=g===truth,exp=id in known_fail;
 if(exp){kf++;console.log((hit?'now passes (update list): ':'known failure: ')+id,g,'truth',truth)}
 else{n++;if(hit)ok++;else{unexpected++;console.log('UNEXPECTED FAIL',id,g,'truth',truth)}}}
console.log(`regression ${ok}/${n} expected-pass, ${kf} known failures listed`);process.exit(unexpected?1:0);
