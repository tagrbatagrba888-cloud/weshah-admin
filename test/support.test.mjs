import {test} from 'node:test';import assert from 'node:assert/strict';
import {request,publicFacts,candidates,providerRequest,finalAnswer,infer,enabled,MODEL,UNAVAILABLE} from '../server/support.mjs';
import {makeSupportHandler} from '../api/support.js';
import {HttpError,STORE} from '../server/security.mjs';
const env={WESHAH_AI_ENABLED:'true',CLOUDFLARE_AI_MODEL:MODEL,CLOUDFLARE_ACCOUNT_ID:'0'.repeat(32),CLOUDFLARE_API_TOKEN:'synthetic-provider-key'};
const lease=fn=>Object.assign(async()=>fn?.(),{expiresAt:Date.now()+40000});
const facts={priceMin:120,priceMax:120,currency:'ج.م',stock:3};
const wrap=content=>({success:true,result:{choices:[{message:{content,reasoning:'must never leave the server'}}]}});
const res=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}});
async function call(body,{deps={},provider,settings=env,origin=STORE,method='POST'}={}){const r=res();await makeSupportHandler(deps,provider,settings)({method,headers:{origin,'content-type':'application/json'},body},r);return r;}
test('only allowlisted topics and at most one catalog ID are accepted',()=>{
 assert.deepEqual(request({topic:'catalog_details',productIds:['published-1']}),{topic:'catalog_details',productIds:['published-1']});
 for(const v of [{topic:'other'},{topic:'catalog_details'}, {topic:'catalog_details',productIds:['../private']},{topic:'shipping_policy',productIds:['unexpected']},{topic:'payment_help',prompt:'private customer text'},{topic:'payment_help',messages:[]},{topic:'payment_help',uid:'another-customer'},[]])assert.throws(()=>request(v));
});
test('provider sees no customer, catalog text, contact, ID or policy prose',()=>{
 const p={status:'active',price:120,stock:3,name:'PRIVATE_NAME',description:'PRIVATE_DESCRIPTION',phone:'PRIVATE_PHONE',returnPolicy:'PRIVATE_POLICY'};
 const s={accounting:{currency:'ج.م'},storefront:{shippingFee:50,freeShippingOver:1000,phone:'PRIVATE_CONTACT',about:'PRIVATE_ABOUT'}};
 const f=publicFacts('catalog_details',p,s),out=JSON.stringify(providerRequest('catalog_details',f,candidates('catalog_details',f)));
 for(const word of ['PRIVATE_','uid','productId','email','address'])assert.equal(out.includes(word),false);
 assert.deepEqual(f,facts);
});
test('draft, archived, hidden and explicitly unpublished products are rejected',()=>{
 for(const p of [null,{status:'draft'},{status:'archived'},{status:'active',hidden:true},{status:'active',published:false},{status:'active',isActive:false}])assert.throws(()=>publicFacts('catalog_details',p));
});
test('variant price ranges, stock and untracked stock are conservative',()=>{
 const p={status:'active',price:100,variants:[{price:120,stock:2},{price:0,stock:3}]};
 assert.deepEqual(publicFacts('catalog_details',p),{priceMin:100,priceMax:120,currency:'ج.م',stock:5});
 assert.equal(publicFacts('catalog_details',{price:100,trackStock:false,stock:9}).stock,null);
 assert.equal(publicFacts('catalog_details',{price:'unsafe',stock:2}).priceMin,null);
 assert.equal(publicFacts('catalog_details',{price:100,stock:2},{accounting:{currency:'PRIVATE_TEXT'}}).priceMin,null);
});
test('missing shipping data is not replaced with guessed fees or delivery dates',()=>{
 const f=publicFacts('shipping_policy',null,{});assert.equal(f.shippingFee,null);assert.equal(f.freeShippingOver,null);
 const a=candidates('shipping_policy',f)[0];assert.match(a.answer,/غير مؤكدة/);assert.match(a.answer,/لا يوجد موعد توصيل مؤكد/);
});
test('answer accepts exact approved JSON and one exact outer JSON fence only',()=>{
 const a=candidates('catalog_details',facts),s=JSON.stringify(a[0]);
 assert.deepEqual(finalAnswer(wrap(s),a),a[0]);
 assert.deepEqual(finalAnswer(wrap('```json\n'+s+'\n```'),a),a[0]);
 for(const v of [s+' extra','prefix '+s,JSON.stringify({...a[0],reasoning:'extra'}),JSON.stringify({...a[0],answer:'invented price 999'}),JSON.stringify({...a[0],handoff:!a[0].handoff}),JSON.stringify({answer:'<img src=x>',handoff:false}),'[]','null'])assert.throws(()=>finalAnswer(wrap(v),a));
});
test('provider request is pinned, bounded, non-streaming and never retried',async()=>{
 let calls=0,seen;
 const a=candidates('catalog_details',facts);
 const answer=await infer('catalog_details',facts,env,async(url,opts)=>{calls++;seen={url,opts,body:JSON.parse(opts.body)};return {ok:true,text:async()=>JSON.stringify(wrap(JSON.stringify(a[0])))}});
 assert.equal(calls,1);assert.deepEqual(answer,a[0]);assert.ok(seen.url.endsWith(MODEL));assert.equal(seen.body.max_completion_tokens,350);assert.equal(seen.body.store,false);assert.equal(seen.body.stream,false);assert.ok(seen.opts.signal);
 await assert.rejects(()=>infer('catalog_details',facts,env,async()=>{calls++;return {ok:false,status:429}}));assert.equal(calls,2);
});
test('only qualified model/config can enable the route',()=>{
 assert.equal(enabled(env),true);assert.equal(enabled({...env,WESHAH_AI_ENABLED:'false'}),false);assert.equal(enabled({...env,CLOUDFLARE_AI_MODEL:'unqualified-model'}),false);assert.equal(enabled({...env,CLOUDFLARE_API_TOKEN:''}),false);
});
test('disabled route performs no auth, storage, budget or provider call',async()=>{
 const r=await call({topic:'payment_help'},{settings:{...env,WESHAH_AI_ENABLED:'false'},deps:new Proxy({},{get(){throw Error('unexpected')}}),provider:()=>{throw Error('unexpected')}});
 assert.equal(r.statusCode,503);assert.equal(r.body.error,UNAVAILABLE);
});
test('raw-text and unknown-field privacy rejection happens before any dependency',async()=>{
 const r=await call({topic:'payment_help',messages:'synthetic personal text'},{deps:new Proxy({},{get(){throw Error('unexpected')}})});assert.equal(r.statusCode,400);assert.equal(JSON.stringify(r.body).includes('synthetic personal text'),false);
});
test('origin is not authorization: missing/expired customer session is rejected',async()=>{
 let providers=0;const r=await call({topic:'payment_help'},{deps:{customer:async()=>{throw new HttpError(401,'internal details')}},provider:()=>providers++});assert.equal(r.statusCode,401);assert.equal(providers,0);assert.equal(JSON.stringify(r.body).includes('internal details'),false);
});
test('wrong origin is rejected before provider/storage calls',async()=>{const r=await call({topic:'payment_help'},{origin:'https://foreign.invalid'});assert.equal(r.statusCode,403)});
test('budget rejects before public facts/provider reads',async()=>{
 let providers=0;const r=await call({topic:'payment_help'},{deps:{customer:async()=> 'own',budget:async()=>{throw new HttpError(429,'budget')}},provider:()=>providers++});assert.equal(r.statusCode,429);assert.equal(providers,0);
});
test('success exposes only final answer metadata and releases concurrency slot',async()=>{
 let released=0;const a=candidates('catalog_details',facts)[0];const r=await call({topic:'catalog_details',productIds:['published-1']},{deps:{customer:async()=> 'own',budget:async()=>lease(()=>released++),facts:async()=>facts},provider:async()=>a});
 assert.equal(r.statusCode,200);assert.equal(released,1);assert.deepEqual(Object.keys(r.body).sort(),['answer','asOf','handoff','mode']);assert.equal(r.headers['Cache-Control'],'no-store');
});
test('provider failures/timeouts/malformed output get fixed text and release slot',async()=>{
 let released=0;const r=await call({topic:'payment_help'},{deps:{customer:async()=> 'own',budget:async()=>lease(()=>released++),facts:async()=>({})},provider:async()=>{throw Error('synthetic secret/internal provider details')}});
 assert.equal(r.statusCode,503);assert.equal(r.body.error,UNAVAILABLE);assert.equal(released,1);assert.equal(JSON.stringify(r.body).includes('synthetic secret'),false);
});
test('facts are re-read after changes and never served from an answer cache',async()=>{
 let reads=0;const deps={customer:async()=> 'own',budget:async()=>lease(),facts:async()=>({...facts,priceMin:++reads*10,priceMax:reads*10})};const provider=async(topic,f)=>candidates(topic,f)[0];
 const a=await call({topic:'catalog_details',productIds:['published-1']},{deps,provider});const b=await call({topic:'catalog_details',productIds:['published-1']},{deps,provider});assert.notEqual(a.body.answer,b.body.answer);assert.equal(reads,2);
});
test('missing, expired or nearly expired concurrency lease never starts provider work',async()=>{
 for(const remaining of [undefined,-1,24000]){
  let providers=0,released=0;const release=async()=>released++;
  if(remaining!==undefined)release.expiresAt=Date.now()+remaining;
  const r=await call({topic:'payment_help'},{deps:{customer:async()=> 'own',budget:async()=>release,facts:async()=>({})},provider:async()=>{providers++;return candidates('payment_help',{})[0]}});
  assert.equal(r.statusCode,503);assert.equal(r.body.error,UNAVAILABLE);assert.equal(providers,0);assert.equal(released,1);
 }
});
test('a slow facts read cannot carry a previously valid concurrency lease into inference',async()=>{
 let providers=0,released=0;const release=lease(()=>released++);
 const r=await call({topic:'payment_help'},{deps:{customer:async()=> 'own',budget:async()=>release,facts:async()=>{release.expiresAt=Date.now()-1;return {}}},provider:async()=>{providers++;return candidates('payment_help',{})[0]}});
 assert.equal(r.statusCode,503);assert.equal(providers,0);assert.equal(released,1);
});
