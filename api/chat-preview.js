import {STORE,HttpError,fail} from '../server/security.mjs';
import {PREVIEW_UID,MODE,aiEnabled,conversationRequest,inferConversation} from '../server/conversation.mjs';
import * as storage from '../server/conversation-storage.mjs';
const UNAVAILABLE='تجربة المحادثة غير متاحة الآن. لم يحدث تعديل حساب أو طلب أو دفع أو إرسال رسالة دعم. لا توجد إعادة محاولة تلقائية.';
export function makeConversationHandler(deps=storage,provider=inferConversation,env=process.env){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
 try{
  if(req.headers.origin!==STORE)fail(403,'افتح التجربة من متجر وشاح.');
  res.setHeader('Access-Control-Allow-Origin',STORE);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
  if(!['GET','POST'].includes(req.method))fail(405,'هذه الطريقة غير متاحة.');
  const uid=await deps.customer(req);if(uid!==PREVIEW_UID)fail(403,'هذه المعاينة معزولة لحساب صاحب المتجر الحالي فقط.');
  if(req.method==='GET')return res.status(200).json({enabled:aiEnabled(env),mode:MODE,...await deps.status(uid)});
  if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON required');
  let body=req.body;if(typeof body==='string'){if(Buffer.byteLength(body)>16384)fail(413,'الرسالة أطول من المسموح.');try{body=JSON.parse(body);}catch{fail(400,'طلب غير صالح.');}}
  if(!body||Buffer.byteLength(JSON.stringify(body))>16384)fail(413,'الرسالة أطول من المسموح.');
  const input=conversationRequest(body);
  if(!aiEnabled(env))fail(503,UNAVAILABLE);
  const release=await deps.budget(uid);
  try{
   const context=await deps.context(input),asOf=Date.now();
   if(!Number.isSafeInteger(release.expiresAt)||release.expiresAt-Date.now()<25000)fail(503,UNAVAILABLE);
   const answer=await provider(input,context,env);
   return res.status(200).json({...answer,asOf,mode:MODE,publicFacts:context});
  }finally{await release();}
 }catch(error){
  const code=error instanceof HttpError?error.status:503;
  return res.status(code).json({error:code===401?'سجّل الدخول بحسابك المعتاد في المتجر أولًا.':code===429?'حد التجربة الحالي وصل. لا نعيد المحاولة تلقائيًا، ولا نغير الحساب لتجاوز الحد.':code>=500?UNAVAILABLE:error.message});
 }
};}
export default makeConversationHandler();
