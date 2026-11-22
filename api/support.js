import {STORE,HttpError,fail} from '../server/security.mjs';
import {enabled,request,infer,UNAVAILABLE} from '../server/support.mjs';
import * as storage from '../server/support-storage.mjs';
export function makeSupportHandler(deps=storage,provider=infer,env=process.env){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
 try{
  const origin=req.headers.origin;
  if(origin&&origin!==STORE)fail(403,'استخدم مساعد المتجر.');
  if(origin===STORE){res.setHeader('Access-Control-Allow-Origin',STORE);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
  if(req.method==='GET')return res.status(200).json({enabled:enabled(env),mode:'public-topics-only'});
  if(req.method!=='POST')fail(405,'هذه الطريقة غير متاحة.');
  if(origin!==STORE)fail(403,'استخدم مساعد المتجر.');
  if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON required');
  let body=req.body;
  if(typeof body==='string'){if(body.length>1024)fail(413,'الطلب أكبر من المسموح.');try{body=JSON.parse(body)}catch{fail(400,'الطلب غير صالح.')}}
  if(!body||JSON.stringify(body).length>1024)fail(400,'الطلب غير صالح.');
  const input=request(body);
  if(!enabled(env))return res.status(503).json({error:UNAVAILABLE,handoff:true});
  const uid=await deps.customer(req);
  const release=await deps.budget(uid);
  try{
   const facts=await deps.facts(input),asOf=Date.now();
   // A delayed Firestore read must not start inference under an expired slot.
   // Leave 20 seconds for the provider deadline plus 5 seconds of headroom.
   if(!Number.isSafeInteger(release.expiresAt)||release.expiresAt-Date.now()<25000)fail(503,UNAVAILABLE);
   const answer=await provider(input.topic,facts,env);
   // Never return provider envelopes, reasoning, prompts, headers or raw errors.
   return res.status(200).json({answer:answer.answer,handoff:answer.handoff,asOf,mode:'public-topics-only'});
  }finally{await release();}
 }catch(e){
  if(e instanceof HttpError){const status=e.status;const error=status===401?'سجّل الدخول لحساب المتجر أولًا.':status===429?'بلغت التجربة حد الاستخدام المتاح حاليًا. جرّب لاحقًا.':status>=500?UNAVAILABLE:e.message;return res.status(status).json({error,handoff:true});}
  return res.status(503).json({error:UNAVAILABLE,handoff:true});
 }
};}
export default makeSupportHandler();
