import {initializeApp,getApps} from 'firebase/app';
import {initializeAuth,inMemoryPersistence,signInWithEmailAndPassword} from 'firebase/auth';
import {initializeFirestore,memoryLocalCache,collection,doc,getDoc,getDocs,query,where,limit,setDoc,deleteDoc,runTransaction} from 'firebase/firestore';
import {initializeApp as initializeAdmin,getApps as adminApps} from 'firebase-admin/app';
import {getAuth as adminAuth} from 'firebase-admin/auth';
import {fail,sha} from './security.mjs';
const config={apiKey:'AIzaSyDx4qDjTvWkzfX2H3SwuVMJe3a-wcr5xhk',authDomain:'matrgar-bf3d1.firebaseapp.com',projectId:'matrgar-bf3d1'};
let resources,authPromise;
export async function resourcesReady(){
 if(!process.env.PUSH_SERVER_EMAIL||!process.env.PUSH_SERVER_PASSWORD||!process.env.PUSH_SERVER_UID)fail(503,'Notification storage is not configured');
 if(!resources){const app=getApps().find(a=>a.name==='push-server')||initializeApp(config,'push-server');const auth=initializeAuth(app,{persistence:inMemoryPersistence});const db=initializeFirestore(app,{localCache:memoryLocalCache(),experimentalForceLongPolling:true});resources={auth,db};}
 if(!resources.auth.currentUser){authPromise??=signInWithEmailAndPassword(resources.auth,process.env.PUSH_SERVER_EMAIL,process.env.PUSH_SERVER_PASSWORD).catch(e=>{authPromise=null;throw e});await authPromise;}
 if(resources.auth.currentUser.uid!==process.env.PUSH_SERVER_UID)fail(503,'Server identity mismatch');
 return resources;
}
export async function customer(req){
 const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];if(!token)fail(401,'Sign in to your store account first');
 try{const app=adminApps()[0]||initializeAdmin({projectId:config.projectId});const decoded=await adminAuth(app).verifyIdToken(token);if(decoded.uid===process.env.PUSH_SERVER_UID)fail(403,'Invalid customer');return decoded.uid;}catch{fail(401,'Store sign-in expired');}
}
export async function rate(key,max,ms){
 const {db}=await resourcesReady();const ref=doc(db,'weshahPushLimits',sha(key));const now=Date.now();
 await runTransaction(db,async tx=>{const snap=await tx.get(ref),prev=snap.data();const data=prev&&prev.until>now?prev:{n:0,until:now+ms};if(data.n>=max)fail(429,'Too many requests. Try again later');tx.set(ref,{n:data.n+1,until:data.until});});
}
export async function putSubscription(uid,sub,consent){
 const {db}=await resourcesReady();const ref=doc(db,'weshahPushSubscriptions',sha(sub.endpoint));
 const all=await getDocs(query(collection(db,'weshahPushSubscriptions'),where('uid','==',uid),limit(6)));
 if(!all.docs.some(d=>d.id===ref.id)&&all.size>=5)fail(409,'Maximum five devices per account. Disable one first');
 await runTransaction(db,async tx=>{const old=await tx.get(ref);if(old.exists()&&old.data().uid!==uid)fail(409,'Disable notifications for the previous account on this device first');tx.set(ref,{uid,subscription:sub,marketing:consent.marketing===true,orders:consent.orders===true,consentedAt:Date.now(),version:1});});
}
export async function removeSubscription(uid,endpoint){const {db}=await resourcesReady();const ref=doc(db,'weshahPushSubscriptions',sha(endpoint));await runTransaction(db,async tx=>{const old=await tx.get(ref);if(old.exists()&&old.data().uid!==uid)fail(403,'Subscription belongs to a different account');tx.delete(ref);});}
export async function recipients(m){
 const {db}=await resourcesReady();let q;
 if(m.type==='product')q=query(collection(db,'weshahPushSubscriptions'),where('marketing','==',true),limit(51));
 else{const order=await getDoc(doc(db,'orders',m.orderId));if(!order.exists()||typeof order.data().uid!=='string')fail(404,'Order not found or has no account');q=query(collection(db,'weshahPushSubscriptions'),where('uid','==',order.data().uid),limit(6));}
 const snap=await getDocs(q);const rows=snap.docs.filter(d=>m.type==='product'||d.data().orders===true).map(d=>({id:d.id,...d.data()}));
 if(rows.length>50)fail(409,'This hobby sender supports at most 50 devices per announcement');
 return rows.sort((a,b)=>a.id.localeCompare(b.id));
}
export async function beginCampaign(id,m,count){const {db}=await resourcesReady();const ref=doc(db,'weshahPushCampaigns',id);await runTransaction(db,async tx=>{if((await tx.get(ref)).exists())fail(409,'This preview was already submitted. Do not repeat it');tx.set(ref,{type:m.type,title:m.title,body:m.body,orderId:m.orderId,count,startedAt:Date.now(),state:'sending'});});}
export async function finishCampaign(id,result){const {db}=await resourcesReady();await setDoc(doc(db,'weshahPushCampaigns',id),{...result,state:'finished',finishedAt:Date.now()},{merge:true});}
export async function removeExpired(id){const {db}=await resourcesReady();await deleteDoc(doc(db,'weshahPushSubscriptions',id));}
export async function stillConsents(row,m){const {db}=await resourcesReady();const snap=await getDoc(doc(db,'weshahPushSubscriptions',row.id));return snap.exists()&&snap.data().uid===row.uid&&(m.type==='product'?snap.data().marketing===true:snap.data().orders===true);}

export async function subscriptionPreferences(uid,endpoint){const {db}=await resourcesReady();const snap=await getDoc(doc(db,'weshahPushSubscriptions',sha(endpoint)));const d=snap.data();return d?.uid===uid?{found:true,orders:d.orders===true,marketing:d.marketing===true}:{found:false,orders:false,marketing:false};}
