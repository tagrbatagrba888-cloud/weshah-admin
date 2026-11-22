import {doc,runTransaction,getDocFromServer,serverTimestamp} from 'firebase/firestore';
import {isDeepStrictEqual} from 'node:util';
import {resourcesReady,rate} from './storage.mjs';
import {normalizedIdentity,profileResponse} from './profile.mjs';
export {rate};
export {profileIdentity} from './profile-identity.mjs';
export function makeProfileStorage({connect=resourcesReady,reference=doc,transaction=runTransaction,read=getDocFromServer,timestamp=serverTimestamp}={}){return async(identity,profile)=>{
 const who=normalizedIdentity(identity),{db}=await connect(),ref=reference(db,'customers',who.uid);
 const allowed=['name','phone','username','addressV1','city','address','profileSchemaVersion'];
 if(Object.keys(profile).some(key=>!allowed.includes(key))||allowed.some(key=>!(key in profile)))throw Error('Unexpected profile patch');
 const patch={...profile,uid:who.uid,email:who.email,profileUpdatedAt:timestamp()};
 await transaction(db,async tx=>{
  const before=await tx.get(ref);
  // Transactionally create bookkeeping only for a genuinely absent record.
  // Existing createdAt, counters and all unknown fields are untouched.
  if(before.exists())tx.update(ref,patch);
  else tx.set(ref,{...patch,createdAt:timestamp(),ordersCount:0});
 });
 const after=await read(ref);if(!after.exists())throw Error('Profile readback missing');
 const row=after.data();
 for(const [key,value]of Object.entries({...who,...profile}))if(!isDeepStrictEqual(row[key],value))throw Error('Profile readback mismatch');
 return profileResponse(who,row);
};}
export const saveProfile=makeProfileStorage();
export function makeProfileReader({connect=resourcesReady,reference=doc,read=getDocFromServer}={}){return async identity=>{
 const who=normalizedIdentity(identity),{db}=await connect();
 const snapshot=await read(reference(db,'customers',who.uid));
 if(!snapshot.exists())return null;
 const row=snapshot.data();
 if(row.profileSchemaVersion===undefined)return null;
 return profileResponse(who,row);
};}
export const readProfile=makeProfileReader();
