import {collection,doc,getDocs,query,orderBy,documentId,limit,startAfter,where,writeBatch,serverTimestamp} from 'firebase/firestore';
import {isDeepStrictEqual} from 'node:util';
import {resourcesReady,rate} from './storage.mjs';
import {encodePrivate} from './private-data.mjs';
export {rate};
export function makePrivateStorage(connect=resourcesReady){return {
 async readPrivate(input){
  const {db}=await connect();
  if(input.action==='get'){
   const snap=await getDocs(query(collection(db,input.collection),where(documentId(),'==',input.id),limit(1))),row=snap.docs[0];
   return {record:row?{id:row.id,data:encodePrivate(row.data())}:null};
  }
  const constraints=[orderBy(documentId()),...(input.cursor?[startAfter(input.cursor)]:[]),limit(51)];
  const snap=await getDocs(query(collection(db,input.collection),...constraints)),records=[];let bytes=0;
  for(const row of snap.docs.slice(0,50)){const value={id:row.id,data:encodePrivate(row.data())},size=Buffer.byteLength(JSON.stringify(value));if(records.length&&bytes+size>2097152)break;records.push(value);bytes+=size;}
  return {records,next:snap.size>records.length?records.at(-1).id:null};
 },
 async writePrivate(input){
  const {db}=await connect(),batch=writeBatch(db),writes=input.action==='batch'?input.writes:[input];
  for(const w of writes){const ref=doc(db,'orders',w.id);if(w.action==='delete')batch.delete(ref);else batch.update(ref,{...w.data,updatedAt:serverTimestamp()});}
  await batch.commit();
  const groups=[];for(let i=0;i<writes.length;i+=30)groups.push(writes.slice(i,i+30).map(w=>w.id));
  const snaps=await Promise.all(groups.map(ids=>getDocs(query(collection(db,'orders'),where(documentId(),'in',ids)))));
  const rows=new Map(snaps.flatMap(s=>s.docs).map(s=>[s.id,s]));
  const records=writes.map(w=>{const row=rows.get(w.id);if(w.action==='delete'){if(row)throw Error('readback');return {id:w.id,deleted:true};}if(!row)throw Error('readback');const data=encodePrivate(row.data());for(const [key,value] of Object.entries(w.data))if(!isDeepStrictEqual(data[key],value))throw Error('readback mismatch');return {id:w.id,data};});
  return {ok:true,records};
 }
};}
export const {readPrivate,writePrivate}=makePrivateStorage();
