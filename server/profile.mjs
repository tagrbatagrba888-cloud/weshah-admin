import {readFileSync} from 'node:fs';
import {fail} from './security.mjs';
import {validateDataset,validateAddress,text,normalizePhone,legacyProjection,DATASET} from './profile-address-model.mjs';
export const PROFILE_SCHEMA = 1;
export const profileDataset = validateDataset(JSON.parse(readFileSync(new URL('./data/egypt-addresses-capmas-2023.json',import.meta.url),'utf8')));
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function keys(value,allowed){if(!plain(value)||Object.keys(value).some(k=>!allowed.includes(k))||allowed.some(k=>!(k in value)))fail(400,'حقول الملف الشخصي غير صالحة.');}
export function profileRequest(body){
 keys(body,['action','name','phone','username','address']);
 if(body.action!=='saveProfile')fail(400,'إجراء الملف الشخصي غير صالح.');
 const a=body.address;
 const fields=a?.mode==='custom'?['datasetVersion','mode','governorateCode','customCenter','customLocality','details']:['datasetVersion','mode','governorateCode','centerCode','localityCode','details'];
 keys(a,fields);
 try{
  const name=text(body.name,160,2),phone=normalizePhone(body.phone),username=text(body.username,40,2);
  if(!/^[\p{L}\p{M}\p{N}_.-]+$/u.test(username))fail(400,'اسم المستخدم: من حرفين إلى ٤٠ حرفًا أو رقمًا أو نقطة أو شرطة، بدون مسافات.');
  const addressV1=validateAddress(a,profileDataset),legacy=legacyProjection(addressV1);
  return {name,phone,username,addressV1,...legacy,profileSchemaVersion:PROFILE_SCHEMA};
 }catch(e){if(e.status)throw e;fail(400,'راجع الاسم والهاتف واسم المستخدم وتسلسل العنوان.');}
}
export function normalizedIdentity(identity){
 if(!identity||typeof identity.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(identity.uid)||typeof identity.email!=='string')fail(401,'سجّل الدخول لحساب المتجر أولًا.');
 const email=identity.email.trim().toLowerCase();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))fail(401,'تعذّر التحقق من بريد الحساب.');
 return {uid:identity.uid,email};
}
// Response whitelist. Never return bookkeeping, admin notes or unknown legacy fields.
export function profileResponse(identity,row){
 const who=normalizedIdentity(identity);
 if(row?.uid!==who.uid||row?.email!==who.email||row?.profileSchemaVersion!==PROFILE_SCHEMA||row?.addressV1?.datasetVersion!==DATASET)throw Error('Profile readback mismatch');
 const addressV1=validateAddress(row.addressV1,profileDataset);
 return {uid:who.uid,email:who.email,name:row.name,phone:row.phone,username:row.username,city:row.city,address:row.address,addressV1,profileSchemaVersion:PROFILE_SCHEMA};
}
