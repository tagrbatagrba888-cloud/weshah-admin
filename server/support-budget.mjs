import {randomBytes} from 'node:crypto';
import {doc,runTransaction} from 'firebase/firestore';
import {fail,sha} from './security.mjs';

// All counters and the concurrency slot are admitted in one transaction.
// Rejected admission cannot consume another customer's or the global budget.
export function createSupportBudget(getResources,{clock=Date.now,newId=()=>randomBytes(16).toString('hex')}={}){
 return async function budget(uid){
  const {db}=await getResources(),id=newId();let expiresAt;
  const inflight=doc(db,'weshahPushLimits',sha('ai:v1:inflight'));
  await runTransaction(db,async tx=>{
   const now=clock(),day=new Date(now).toISOString().slice(0,10),dayEnd=Date.parse(day+'T00:00:00Z')+86400000;
   const limits=[
    {key:'ai:v1:minute:'+uid,max:2,until:now+60000},
    {key:'ai:v1:customer-day:'+day+':'+uid,max:3,until:dayEnd},
    {key:'ai:v1:global-day:'+day,max:10,until:dayEnd}
   ].map(v=>({...v,ref:doc(db,'weshahPushLimits',sha(v.key))}));
   const snapshots=await Promise.all(limits.map(v=>tx.get(v.ref))),slotSnapshot=await tx.get(inflight);
   const slots=(slotSnapshot.data()?.slots||[]).filter(s=>Number.isSafeInteger(s.until)&&s.until>now);
   if(slots.length>=2)fail(429,'المساعد مشغول الآن. جرّب لاحقًا.');
   const counts=limits.map((v,i)=>{const previous=snapshots[i].data();const n=previous&&previous.until>now?previous.n:0;if(!Number.isSafeInteger(n)||n<0||n>=v.max)fail(429,'بلغت التجربة حد الاستخدام المتاح حاليًا.');return {n:n+1,until:previous&&previous.until>now?previous.until:v.until};});
   expiresAt=now+40000;
   limits.forEach((v,i)=>tx.set(v.ref,counts[i]));
   tx.set(inflight,{slots:[...slots,{id,until:expiresAt}]});
  });
  const release=async()=>{
   try{await runTransaction(db,async tx=>{const snapshot=await tx.get(inflight),now=clock();tx.set(inflight,{slots:(snapshot.data()?.slots||[]).filter(s=>s.id!==id&&Number.isSafeInteger(s.until)&&s.until>now)});});}
   catch{/* Failed cleanup cannot extend a slot beyond its bounded lease. */}
  };
  return Object.assign(release,{expiresAt});
 };
}
