import {fail} from './security.mjs';
export const PRIVATE_COLLECTIONS=['customers','orders'];
const statuses=['pending','processing','shipped','completed','cancelled','refunded'];
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export function identifier(v){if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v))fail(400,'Invalid record identifier');return v;}
export function table(v){if(!PRIVATE_COLLECTIONS.includes(v))fail(400,'Unsupported private collection');return v;}
const text=(v,max)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail(400,'Invalid text field');return v;};
export function orderPatch(value){
 if(!plain(value))fail(400,'Invalid order update');
 const sizes={stage:100,stageName:160,customerNote:2000,customerName:160,phone:40,city:200,address:2000,shipCompany:160,trackingNo:200,notes:2000,adminNote:4000};
 const allowed=[...Object.keys(sizes),'status','stageAt','timeline','restocked','updatedAt'];
 if(!Object.keys(value).length||Object.keys(value).some(k=>!allowed.includes(k)))fail(400,'Unsupported order field');
 const out={};
 for(const [k,v] of Object.entries(value)){
  if(k==='updatedAt')continue;
  if(k in sizes)out[k]=text(v,sizes[k]);
  else if(k==='status'){if(!statuses.includes(v))fail(400,'Invalid order status');out[k]=v;}
  else if(k==='stageAt'){if(!Number.isSafeInteger(v)||v<0)fail(400,'Invalid stage time');out[k]=v;}
  else if(k==='restocked'){if(typeof v!=='boolean')fail(400,'Invalid stock marker');out[k]=v;}
  else if(k==='timeline'){
   if(!Array.isArray(v)||v.length>120)fail(400,'Invalid order timeline');
   out[k]=v.map(entry=>{
    if(!plain(entry)||Object.keys(entry).some(x=>!['stage','name','status','at','note','public','by'].includes(x)))fail(400,'Invalid timeline entry');
    const e={};for(const [key,val] of Object.entries(entry)){
     if(key==='at'){if(!Number.isSafeInteger(val)||val<0)fail(400,'Invalid timeline time');e[key]=val;}
     else if(key==='public'){if(typeof val!=='boolean')fail(400,'Invalid timeline visibility');e[key]=val;}
     else if(key==='status'){if(!statuses.includes(val))fail(400,'Invalid timeline status');e[key]=val;}
     else e[key]=text(val,key==='note'?2000:160);
    }return e;
   });
  }
 }
 if(!Object.keys(out).length)fail(400,'Empty order update');return out;
}
export function privateRequest(body){
 if(!plain(body)||Object.keys(body).some(k=>!['action','collection','id','cursor','data','writes'].includes(k)))fail(400,'Invalid private request');
 const action=body.action;
 if(action==='list'){if(Object.keys(body).some(k=>!['action','collection','cursor'].includes(k)))fail(400,'Invalid list request');return {action,collection:table(body.collection),cursor:body.cursor==null?'':identifier(body.cursor)};}
 if(action==='get'){if(Object.keys(body).some(k=>!['action','collection','id'].includes(k)))fail(400,'Invalid read request');return {action,collection:table(body.collection),id:identifier(body.id)};}
 if(action==='update'||action==='delete'){
  if(body.collection!=='orders'||Object.keys(body).some(k=>!['action','collection','id',...(action==='update'?['data']:[])].includes(k)))fail(400,'Unsupported private write');
  return {action,collection:'orders',id:identifier(body.id),...(action==='update'?{data:orderPatch(body.data)}:{})};
 }
 if(action==='batch'){
  if(Object.keys(body).some(k=>!['action','writes'].includes(k))||!Array.isArray(body.writes)||!body.writes.length||body.writes.length>400)fail(400,'Invalid private batch');
  const writes=body.writes.map(x=>privateRequest(x));if(writes.some(x=>!['update','delete'].includes(x.action))||new Set(writes.map(x=>x.id)).size!==writes.length)fail(400,'Invalid private batch operations');return {action,writes};
 }
 fail(400,'Unsupported private action');
}
export function encodePrivate(value){
 if(value&&typeof value.toMillis==='function'&&Number.isInteger(value.seconds))return {__weshahTimestamp:[value.seconds,value.nanoseconds]};
 if(Array.isArray(value))return value.map(encodePrivate);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encodePrivate(v)]));
 return value;
}
