import {createHash,randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
export const RESERVED=['weshahPushSubscriptions','weshahPushLimits','weshahPushCampaigns'];
export const STORE='https://weshah-store.vercel.app';
export const ADMIN='https://weshah-admin.vercel.app';
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export const fail=(status,message)=>{throw new HttpError(status,message)};
export const sha=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export function passwordMatches(username,password,env=process.env){
 if(!env.PUSH_ADMIN_VERIFIER||!env.PUSH_ADMIN_SALT||!env.PUSH_ADMIN_USER) return false;
 if(typeof username!=='string'||typeof password!=='string'||username.length>100||password.length>512) return false;
 const computed=scryptSync(username.trim()+':'+password,env.PUSH_ADMIN_SALT,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
 return equal(username.trim(),env.PUSH_ADMIN_USER)&&equal(computed,env.PUSH_ADMIN_VERIFIER);
}
export function sign(value,secret=process.env.PUSH_SESSION_SECRET){
 if(!secret||secret.length<40) fail(503,'Notification server is not configured');
 const data=Buffer.from(JSON.stringify(value)).toString('base64url');
 return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');
}
export function verify(token,secret=process.env.PUSH_SESSION_SECRET,now=Date.now()){
 if(!secret||!token||token.length>12000)return null;
 try{const [data,mac,...extra]=token.split('.');if(extra.length||!equal(mac,createHmac('sha256',secret).update(data).digest('base64url')))return null;
 const v=JSON.parse(Buffer.from(data,'base64url'));return Number.isFinite(v.exp)&&v.exp>now?v:null;}catch{return null}
}
export function session(cookie=''){const value=cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('__Host-weshahPush='))?.split('=')[1];const s=verify(value);return s?.kind==='admin'?s:null;}
export function cookie(remember=false){const seconds=remember?604800:28800;return '__Host-weshahPush='+sign({kind:'admin',jti:randomBytes(16).toString('hex'),exp:Date.now()+seconds*1000})+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+seconds;}
export function subscription(value){
 if(!value||typeof value!=='object')fail(400,'Invalid subscription');
 let url;try{url=new URL(value.endpoint)}catch{fail(400,'Invalid push endpoint')}
 const host=url.hostname.toLowerCase();
 const permitted=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='web.push.apple.com'||host.endsWith('.notify.windows.com');
 if(url.protocol!=='https:'||url.username||url.password||url.hash||(url.port&&url.port!=='443')||!permitted||url.href.length>2500)fail(400,'Unsupported push provider');
 const keys=value.keys||{};
 for(const [key,length] of [['p256dh',65],['auth',16]]){
  if(typeof keys[key]!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(keys[key])||Buffer.from(keys[key],'base64url').length!==length)fail(400,'Invalid push encryption keys');
 }
 if(Buffer.from(keys.p256dh,'base64url')[0]!==4)fail(400,'Invalid public key');
 return {endpoint:url.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
export function message(value){
 const type=value?.type;
 if(!['product','confirmation','delivery'].includes(type))fail(400,'Invalid notification type');
 const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail(400,'Invalid notification text');return v.trim()};
 const title=text(value.title,80),body=text(value.body,240);
 const orderId=type==='product'?'':text(value.orderId,128);
 if(orderId&&!/^[A-Za-z0-9_-]+$/.test(orderId))fail(400,'Invalid order ID');
 return {type,title,body,orderId};
}
export function payload(m,id){return JSON.stringify({title:m.title,body:m.body,tag:'weshah-'+id,url:STORE+(m.type==='product'?'/':'/?orders=1'),icon:STORE+'/1-icon-192.png'});}
