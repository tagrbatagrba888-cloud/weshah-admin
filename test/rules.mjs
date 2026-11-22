import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc} from 'firebase/firestore';
import {readFile} from 'node:fs/promises';
import {test,after} from 'node:test';
const env=await initializeTestEnvironment({projectId:'demo-weshah-push',firestore:{host:'127.0.0.1',port:8089,rules:await readFile('firestore.rules','utf8')}});
after(()=>env.cleanup());
const actors={guest:env.unauthenticatedContext().firestore(),customer:env.authenticatedContext('ordinary-customer').firestore(),server:env.authenticatedContext('8wGuAyip2ROrhSklnmz6YYlF1Xx2').firestore()};
const reserved=['weshahPushSubscriptions','weshahPushLimits','weshahPushCampaigns','subscribers'];
const legacy=['products','reviews','questions','coupons','images','image_chunks','settings','suppliers','expenses','unknownLegacyCollection'];
for(const name of [...legacy,...reserved]) for(const nested of [false,true]){
 const path=name+'/fixture'+(nested?'/nested/fixture':'');
 await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),path),{before:true}));
 for(const [actor,db] of Object.entries(actors)){
  const permitted=!reserved.includes(name)||actor==='server';
  const check=permitted?assertSucceeds:assertFails;
  test(`${actor} ${path}: ${permitted?'allow':'deny'} all operations`,async()=>{
   const ref=doc(db,path);
   await check(getDoc(ref));
   await check(getDocs(collection(db,path.split('/').slice(0,-1).join('/'))));
   await check(setDoc(doc(db,path+'-'+actor),{created:true}));
   await check(updateDoc(ref,{updated:actor}));
   await check(deleteDoc(doc(db,path+'-'+actor)));
  });
 }
}
