import {getDoc as nativeGetDoc,getDocs as nativeGetDocs,updateDoc as nativeUpdateDoc,deleteDoc as nativeDeleteDoc,writeBatch as nativeWriteBatch,Timestamp} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const privateTable=ref=>ref?.type==='collection'&&['customers','orders'].includes(ref.path)?ref.path:null;
const privateDocument=ref=>typeof ref?.path==='string'&&/^(customers|orders)\/[A-Za-z0-9_-]{1,128}$/.test(ref.path)?ref.path.split('/'):null;
function revive(v){if(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&Array.isArray(v.__weshahTimestamp))return new Timestamp(...v.__weshahTimestamp);if(Array.isArray(v))return v.map(revive);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,revive(x)]));return v;}
function snapshot(row,id){return {id:row?.id||id,exists:()=>!!row,data:()=>row?revive(JSON.parse(JSON.stringify(row.data))):undefined};}
async function request(body){
 const response=await fetch('/api/private',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 if(!response.ok){const error=new Error(response.status===401?'انتهت جلسة الإدارة. سجّل الدخول بنفس بياناتك.':'تعذّر الوصول إلى البيانات الخاصة. لم نعد إرسال العملية تلقائيًا.');error.code=response.status===401?'unauthenticated':'private-data-unavailable';throw error;}
 return response.json();
}
const patch=value=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='updatedAt'));
export async function getDoc(ref){const p=privateDocument(ref);if(!p)return nativeGetDoc(ref);return snapshot((await request({action:'get',collection:p[0],id:p[1]})).record,p[1]);}
export async function getDocs(ref){
 const collection=privateTable(ref);if(!collection)return nativeGetDocs(ref);
 const docs=[];let cursor=null;
 do{const page=await request({action:'list',collection,...(cursor?{cursor}:{})});if(!Array.isArray(page.records))throw Error('Invalid private response');docs.push(...page.records.map(x=>snapshot(x,x.id)));cursor=page.next;if(cursor&&docs.length>=2000)throw Error('عدد السجلات يتجاوز حد عرض هذه النسخة. لم نعرض نتائج جزئية.');}while(cursor);
 return {docs,size:docs.length,empty:!docs.length,forEach:fn=>docs.forEach(fn)};
}
export async function updateDoc(ref,data,...rest){const p=privateDocument(ref);if(!p)return nativeUpdateDoc(ref,data,...rest);if(rest.length)throw Error('Unsupported private update');await request({action:'update',collection:p[0],id:p[1],data:patch(data)});}
export async function deleteDoc(ref){const p=privateDocument(ref);if(!p)return nativeDeleteDoc(ref);await request({action:'delete',collection:p[0],id:p[1]});}
export function writeBatch(db){
 const operations=[];let committed=false;
 const batch={set(ref,...args){operations.push({method:'set',ref,args});return batch;},update(ref,...args){operations.push({method:'update',ref,args});return batch;},delete(ref,...args){operations.push({method:'delete',ref,args});return batch;},async commit(){
  if(committed)throw Error('Batch already committed');committed=true;
  const privateCount=operations.filter(x=>privateDocument(x.ref)).length;
  if(!privateCount){const native=nativeWriteBatch(db);for(const x of operations)native[x.method](x.ref,...x.args);return native.commit();}
  if(privateCount!==operations.length||operations.some(x=>x.method==='set'||x.args.length>(x.method==='update'?1:0)))throw Error('Mixed private/public batches are not supported; nothing was written');
  const writes=operations.map(x=>{const p=privateDocument(x.ref);return {action:x.method,collection:p[0],id:p[1],...(x.method==='update'?{data:patch(x.args[0])}:{})};});
  await request({action:'batch',writes});
 }};return batch;
}
