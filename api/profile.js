import {STORE,HttpError,fail} from '../server/security.mjs';
import {profileRequest,normalizedIdentity,profileResponse} from '../server/profile.mjs';
import * as storage from '../server/profile-storage.mjs';
export function makeProfileHandler(deps=storage){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
 try{
  if(req.headers.origin!==STORE)fail(403,'استخدم حسابك من موقع المتجر.');
  res.setHeader('Access-Control-Allow-Origin',STORE);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method==='GET'){
   const identity=normalizedIdentity(await deps.profileIdentity(req));
   await deps.rate('profile:read:'+identity.uid,20,60000);
   const profile=await deps.readProfile(identity);
   return res.status(200).json({ok:true,uid:identity.uid,profile,completionRequired:profile===null});
  }
  if(req.method!=='POST')fail(405,'هذه الطريقة غير متاحة.');
  if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')fail(415,'JSON required');
  let body=req.body;
  if(typeof body==='string'){
   if(Buffer.byteLength(body)>12288)fail(413,'الطلب أكبر من المسموح.');
   try{body=JSON.parse(body);}catch{fail(400,'الطلب غير صالح.');}
  }
  if(!body||Buffer.byteLength(JSON.stringify(body))>12288)fail(413,'الطلب أكبر من المسموح.');
  const input=profileRequest(body),identity=normalizedIdentity(await deps.profileIdentity(req));
  await deps.rate('profile:'+identity.uid,10,60000);
  const saved=await deps.saveProfile(identity,input);
  return res.status(200).json({ok:true,profile:profileResponse(identity,saved)});
 }catch(e){
  const known=e instanceof HttpError;
  return res.status(known?e.status:503).json({error:known?e.message:(req.method==='GET'?'تعذّر قراءة بيانات الحساب الآن.':'تعذّر تأكيد حفظ البيانات الآن. حساب الدخول لم يُحذف. راجع بياناتك وأعد محاولة الحفظ من نفس الحساب.'),confirmed:false});
 }
};}
export default makeProfileHandler();
