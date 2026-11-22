import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc} from 'firebase/firestore';
import {readFile} from 'node:fs/promises';
import {test,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createSupportBudget} from '../server/support-budget.mjs';
import {sha} from '../server/security.mjs';
const env=await initializeTestEnvironment({projectId:'demo-weshah-push',firestore:{host:'127.0.0.1',port:8089,rules:await readFile('firestore.rules','utf8')}});
const db=env.authenticatedContext('8wGuAyip2ROrhSklnmz6YYlF1Xx2').firestore();
let now=Date.parse('2026-11-22T12:00:00Z');
const budget=createSupportBudget(async()=>({db}),{clock:()=>now});
const counter=async key=>(await getDoc(doc(db,'weshahPushLimits',sha(key)))).data();
const reject=p=>assert.rejects(p,e=>e.status===429);
beforeEach(async()=>{await env.clearFirestore();now=Date.parse('2026-11-22T12:00:00Z');});
after(()=>env.cleanup());
test('admission writes all three counters and a bounded slot, release is idempotent',async()=>{
 const release=await budget('synthetic-a');assert.equal(release.expiresAt,now+40000);
 assert.equal((await counter('ai:v1:minute:synthetic-a')).n,1);assert.equal((await counter('ai:v1:customer-day:2026-11-22:synthetic-a')).n,1);assert.equal((await counter('ai:v1:global-day:2026-11-22')).n,1);
 assert.equal((await counter('ai:v1:inflight')).slots.length,1);await release();await release();assert.equal((await counter('ai:v1:inflight')).slots.length,0);
});
test('minute limit rejects atomically without consuming global/customer daily quota',async()=>{
 await (await budget('synthetic-a'))();await (await budget('synthetic-a'))();await reject(budget('synthetic-a'));
 assert.equal((await counter('ai:v1:global-day:2026-11-22')).n,2);assert.equal((await counter('ai:v1:customer-day:2026-11-22:synthetic-a')).n,2);
 now+=60001;await (await budget('synthetic-a'))();await reject(budget('synthetic-a'));assert.equal((await counter('ai:v1:global-day:2026-11-22')).n,3);
});
test('daily customer limit survives minute resets',async()=>{
 for(let i=0;i<3;i++){await (await budget('synthetic-a'))();now+=60001;}
 await reject(budget('synthetic-a'));assert.equal((await counter('ai:v1:minute:synthetic-a')).n,1);assert.equal((await counter('ai:v1:global-day:2026-11-22')).n,3);
});
test('global daily ceiling applies across distinct customers',async()=>{
 for(let i=0;i<10;i++)await (await budget('synthetic-'+i))();
 await reject(budget('synthetic-extra'));assert.equal((await counter('ai:v1:global-day:2026-11-22')).n,10);assert.equal(await counter('ai:v1:minute:synthetic-extra'),undefined);
});
test('concurrent admissions cannot exceed two slots or spend rejected budgets',async()=>{
 const results=await Promise.allSettled(Array.from({length:8},(_,i)=>budget('synthetic-concurrent-'+i)));
 const accepted=results.filter(r=>r.status==='fulfilled');assert.equal(accepted.length,2);assert.equal((await counter('ai:v1:inflight')).slots.length,2);assert.equal((await counter('ai:v1:global-day:2026-11-22')).n,2);
 for(const r of results.filter(r=>r.status==='rejected'))assert.equal(r.reason.status,429);
 await accepted[0].value();const third=await budget('synthetic-third');assert.equal((await counter('ai:v1:inflight')).slots.length,2);await third();await accepted[1].value();
});
test('expired slots recover and old cleanup cannot remove a newer slot',async()=>{
 const old=await budget('synthetic-a');await budget('synthetic-b');now+=40001;
 const fresh=await budget('synthetic-c');await old();assert.equal((await counter('ai:v1:inflight')).slots.length,1);await fresh();assert.equal((await counter('ai:v1:inflight')).slots.length,0);
});
test('UTC day rollover resets daily counters without losing live concurrency leases',async()=>{
 now=Date.parse('2026-11-22T23:59:50Z');const old=await budget('synthetic-a');now+=10001;await budget('synthetic-b');await reject(budget('synthetic-c'));
 assert.equal((await counter('ai:v1:global-day:2026-11-23')).n,1);await old();await (await budget('synthetic-c'))();assert.equal((await counter('ai:v1:global-day:2026-11-23')).n,2);
});
test('ordinary users cannot read/write budget docs and cannot admit inference',async()=>{
 const customer=env.authenticatedContext('synthetic-customer').firestore(),guest=env.unauthenticatedContext().firestore();
 await budget('synthetic-a');const id=sha('ai:v1:global-day:2026-11-22');
 for(const actor of [customer,guest]){await assertFails(getDoc(doc(actor,'weshahPushLimits',id)));await assertFails(setDoc(doc(actor,'weshahPushLimits',id),{n:0,until:now+86400000}));await assert.rejects(()=>createSupportBudget(async()=>({db:actor}),{clock:()=>now})('synthetic-a'));}
});
