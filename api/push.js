import {randomBytes} from 'node:crypto';
import webpush from 'web-push';
import {ADMIN,STORE,HttpError,fail,passwordMatches,cookie,session,sign,verify,subscription,message,payload,sha,testUid,sendingEnabled} from '../server/security.mjs';
import * as storage from '../server/storage.mjs';
export function makeHandler(deps=storage,push=webpush){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
 try{
  const origin=req.headers.origin;
  if(origin&&![ADMIN,STORE].includes(origin))fail(403,'Origin not allowed');
  if(origin===STORE){res.setHeader('Access-Control-Allow-Origin',STORE);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
  const action=req.query?.action||new URL(req.url,'https://local.invalid').searchParams.get('action');
  if(req.method==='GET'&&action==='config')return res.status(200).json({publicKey:process.env.PUSH_VAPID_PUBLIC||'',enabled:!!process.env.PUSH_SERVER_UID});
  if(req.method==='GET'&&action==='session')return res.status(200).json({authenticated:!!session(req.headers.cookie),sendingEnabled:sendingEnabled(),testOnly:true});
  if(req.method!=='POST')fail(405,'Method not allowed');
  if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON required');
  let body=req.body;if(typeof body==='string'){if(body.length>12000)fail(413,'Request too large');try{body=JSON.parse(body)}catch{fail(400,'Invalid JSON')}}
  if(!body||typeof body!=='object'||JSON.stringify(body).length>12000)fail(400,'Invalid request');
  if(['subscribe','unsubscribe','preferences'].includes(action)){
   if(origin!==STORE)fail(403,'Use the store notification settings');
   const uid=await deps.customer(req);await deps.rate('subscription:'+uid,30,3600000);
   if(action==='preferences'){const sub=subscription(body.subscription);return res.status(200).json(await deps.subscriptionPreferences(uid,sub.endpoint));}
   if(action==='subscribe'){
    const sub=subscription(body.subscription);if(typeof body.marketing!=='boolean'||typeof body.orders!=='boolean'||(!body.marketing&&!body.orders))fail(400,'Choose a notification category');
    await deps.putSubscription(uid,sub,{marketing:body.marketing,orders:body.orders});
   }else{const sub=subscription(body.subscription);await deps.removeSubscription(uid,sub.endpoint);}
   return res.status(200).json({ok:true});
  }
  if(origin!==ADMIN)fail(403,'Use the administration website');
  if(action==='login'){
   // Always use the same slow credential proof, never the public client hash.
   await deps.rate('login:'+String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim(),8,900000);
   if(!passwordMatches(body.username,body.password))fail(401,'Incorrect administration credentials');
   res.setHeader('Set-Cookie',cookie(body.remember===true));return res.status(200).json({ok:true});
  }
  if(action==='logout'){res.setHeader('Set-Cookie','__Host-weshahPush=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return res.status(200).json({ok:true});}
  const auth=session(req.headers.cookie);if(!auth)fail(401,'Sign out and back in using the existing administration login');
  if(!['preview','send'].includes(action))fail(404,'Unknown action');
  const m=message(body),rows=await deps.recipients(m),audience=sha(rows.map(r=>r.id).join('|'));
  if(testUid()&&rows.some(row=>row.uid!==testUid()))fail(503,'Test audience is not isolated');
  if(action==='preview'){
   const id=randomBytes(16).toString('hex');
   return res.status(200).json({count:rows.length,previewToken:sign({kind:'preview',jti:auth.jti,id,digest:sha(JSON.stringify(m)),audience,exp:Date.now()+120000}),message:m,sendingEnabled:sendingEnabled(),testOnly:true});
  }
  if(!sendingEnabled())fail(503,'Sending is disabled or the isolated test account is not configured');
  if(!process.env.PUSH_VAPID_PUBLIC||!process.env.PUSH_VAPID_PRIVATE)fail(503,'Push signing is not configured');
  const proof=verify(body.previewToken);
  if(proof?.kind!=='preview'||proof.jti!==auth.jti||proof.digest!==sha(JSON.stringify(m))||proof.audience!==audience)fail(409,'Preview expired or recipients changed. Preview again');
  if(!rows.length)fail(409,'No consenting devices for this audience');
  await deps.rate('send:admin',10,3600000);await deps.beginCampaign(proof.id,m,rows.length);
  const result={accepted:0,expired:0,failed:0,skipped:0};
  push.setVapidDetails(process.env.PUSH_VAPID_SUBJECT||ADMIN,process.env.PUSH_VAPID_PUBLIC,process.env.PUSH_VAPID_PRIVATE);
  // Bound network fan-out so a full 50-device hobby audience fits the function budget.
  let cursor=0;
  async function worker(){
   while(cursor<rows.length){
    const row=rows[cursor++];
    try{
     if(!await deps.stillConsents(row,m)){result.skipped++;continue;}
     await push.sendNotification(subscription(row.subscription),payload(m,proof.id),{TTL:3600,timeout:7000,urgency:m.type==='product'?'normal':'high'});
     result.accepted++;
    }catch(e){
     if(e.statusCode===404||e.statusCode===410){
      result.expired++;
      try{await deps.removeExpired(row.id);}catch{result.cleanupFailed=(result.cleanupFailed||0)+1;}
     }else result.failed++;
    }
   }
  }
  await Promise.all(Array.from({length:Math.min(5,rows.length)},()=>worker()));
  await deps.finishCampaign(proof.id,result);
  return res.status(200).json({ok:true,...result,note:'Accepted means accepted by the browser push provider, not confirmed displayed on a device.'});
 }catch(e){const status=e instanceof HttpError?e.status:503;return res.status(status).json({error:e instanceof HttpError?e.message:'Notification service temporarily unavailable. No automatic retry was made.'});}
};}
export default makeHandler();
