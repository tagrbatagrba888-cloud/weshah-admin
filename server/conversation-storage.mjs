import {doc,getDoc} from 'firebase/firestore';
import {resourcesReady,customer} from './storage.mjs';
import {createSupportBudget} from './support-budget.mjs';
import {conversationContext} from './conversation.mjs';
import {sha} from './security.mjs';
export {customer};
export const budget=createSupportBudget(resourcesReady);
export async function context(input){
 const {db}=await resourcesReady(),site=await getDoc(doc(db,'settings','site'));
 let product=null;if(input.productIds.length){const p=await getDoc(doc(db,'products',input.productIds[0]));if(p.exists())product=p.data();else throw Error('product unavailable');}
 return conversationContext(product,site.exists()?site.data():{});
}
export function budgetState(records,now=Date.now()){
 const date=new Date(now).toISOString().slice(0,10),resetAt=Date.parse(date+'T00:00:00Z')+86400000;
 const count=(record,max)=>{if(!record||record.until<=now)return 0;if(!Number.isSafeInteger(record.n)||record.n<0||record.n>max||!Number.isSafeInteger(record.until))throw Error('invalid budget');return record.n;};
 const customer=count(records.customer,3),global=count(records.global,10),minute=count(records.minute,2);
 return {remainingToday:Math.max(0,Math.min(3-customer,10-global)),remainingThisMinute:2-minute,resetsAt:new Date(resetAt).toISOString(),asOf:now};
}
export async function status(uid){
 const {db}=await resourcesReady(),now=Date.now(),day=new Date(now).toISOString().slice(0,10);
 const keys={customer:'ai:v1:customer-day:'+day+':'+uid,global:'ai:v1:global-day:'+day,minute:'ai:v1:minute:'+uid};
 const rows=await Promise.all(Object.entries(keys).map(async([key,value])=>[key,(await getDoc(doc(db,'weshahPushLimits',sha(value)))).data()]));
 return budgetState(Object.fromEntries(rows),now);
}
