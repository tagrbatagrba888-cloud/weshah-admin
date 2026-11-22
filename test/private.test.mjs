import {test} from 'node:test';import assert from 'node:assert/strict';
import {privateRequest,orderPatch,encodePrivate} from '../server/private-data.mjs';
import {makePrivateHandler} from '../api/private.js';
import {ADMIN,STORE,sign} from '../server/security.mjs';
process.env.PUSH_SESSION_SECRET='test-only-private-session-secret-'.repeat(3);
const auth='__Host-weshahPush='+sign({kind:'admin',jti:'test-admin',exp:Date.now()+60000});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
async function call(body,{origin=ADMIN,cookie=auth,method='POST',deps={}}={}){const res=response(),calls=[];const fake={rate:async()=>{},readPrivate:async input=>{calls.push(input);return {records:[],next:null};},writePrivate:async input=>{calls.push(input);return {ok:true,records:[]};},...deps};await makePrivateHandler(fake)({method,headers:{origin,cookie,'content-type':'application/json'},body},res);return {res,calls};}
test('private reads have a strict two-collection flat-path allowlist',()=>{
 assert.deepEqual(privateRequest({action:'get',collection:'customers',id:'synthetic-a'}),{action:'get',collection:'customers',id:'synthetic-a'});
 for(const body of [{action:'list',collection:'products'},{action:'get',collection:'orders',id:'../private'},{action:'get',collection:'customers',id:'x/nested/y'},{action:'list',collection:'customers',uid:'foreign'},{action:'delete',collection:'customers',id:'x'},{action:'update',collection:'orders',id:'x',data:{uid:'foreign'}},{action:'update',collection:'orders',id:'x',data:{total:0}},{action:'update',collection:'orders',id:'x',data:{role:'admin'}}])assert.throws(()=>privateRequest(body));
});
test('manual order patch permits current UI fields, not identity or money fields',()=>{
 assert.deepEqual(orderPatch({status:'processing',customerNote:'Synthetic note',updatedAt:{ignored:true}}),{status:'processing',customerNote:'Synthetic note'});
 for(const body of [{status:'made-up'},{stageAt:-1},{restocked:'yes'},{timeline:[{name:'test',uid:'foreign'}]},{timeline:[{name:'test',public:'yes'}]},{updatedAt:123},{phone:'x'.repeat(41)}])assert.throws(()=>orderPatch(body));
});
test('private batch is bounded, rejects duplicate IDs and nested/read operations',()=>{
 const update={action:'update',collection:'orders',id:'synthetic-a',data:{status:'pending'}};
 assert.equal(privateRequest({action:'batch',writes:[update]}).writes.length,1);
 for(const writes of [[],[update,update],[{action:'list',collection:'orders'}],Array(401).fill(update),[{action:'batch',writes:[update]}]])assert.throws(()=>privateRequest({action:'batch',writes}));
});
test('guest, forged cookie, customer-origin and missing-origin never reach storage',async()=>{
 for(const opts of [{cookie:''},{cookie:'__Host-weshahPush=forged'},{origin:STORE},{origin:'https://foreign.invalid'},{origin:''},{method:'GET'}]){const {res,calls}=await call({action:'list',collection:'customers'},opts);assert.ok([401,403,405].includes(res.statusCode));assert.equal(calls.length,0);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.headers['Access-Control-Allow-Origin'],undefined);}
});
test('verified existing admin session reaches only validated operations',async()=>{
 const {res,calls}=await call({action:'update',collection:'orders',id:'synthetic-a',data:{status:'processing'}});assert.equal(res.statusCode,200);assert.equal(calls.length,1);assert.equal(calls[0].data.status,'processing');
});
test('oversized input and storage failure do not produce false success or retries',async()=>{
 const large=await call({action:'get',collection:'orders',id:'x',extra:'x'.repeat(1048576)});assert.equal(large.res.statusCode,413);assert.equal(large.calls.length,0);
 let attempts=0;const failure=await call({action:'get',collection:'orders',id:'x'},{deps:{readPrivate:async()=>{attempts++;throw Error('private detail must not leak');}}});assert.equal(attempts,1);assert.equal(failure.res.statusCode,503);assert.equal(JSON.stringify(failure.res.body).includes('private detail'),false);
});
test('private timestamp encoding is data-only',()=>{assert.deepEqual(encodePrivate({at:{seconds:2,nanoseconds:3,toMillis:()=>2000}}),{at:{__weshahTimestamp:[2,3]}});});
