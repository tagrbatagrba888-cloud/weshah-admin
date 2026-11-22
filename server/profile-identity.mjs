import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {fail} from './security.mjs';
import {normalizedIdentity} from './profile.mjs';
export function makeProfileIdentity(verify,env=process.env){return async req=>{
 const value=req.headers.authorization;
 const token=typeof value==='string'&&value.length<=12000?value.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1]:null;
 if(!token)fail(401,'سجّل الدخول لحساب المتجر أولًا.');
 let decoded;try{decoded=await verify(token);}catch{fail(401,'انتهت جلسة حساب المتجر. سجّل الدخول مجددًا.');}
 const identity=normalizedIdentity(decoded);
 if(identity.uid===env.PUSH_SERVER_UID)fail(403,'هذا الحساب غير متاح كحساب عميل.');
 return identity;
};}
export const profileIdentity=makeProfileIdentity(async token=>{
 const app=getApps().find(a=>a.name==='profile-token-verifier')||initializeApp({projectId:'matrgar-bf3d1'},'profile-token-verifier');
 return getAuth(app).verifyIdToken(token);
});
