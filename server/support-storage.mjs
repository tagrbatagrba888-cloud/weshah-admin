import {doc,getDoc} from 'firebase/firestore';
import {resourcesReady,customer} from './storage.mjs';
import {publicFacts} from './support.mjs';
import {createSupportBudget} from './support-budget.mjs';
export {customer};
export const budget=createSupportBudget(resourcesReady);
export async function facts(input){
 const {db}=await resourcesReady();
 const site=await getDoc(doc(db,'settings','site'));
 let product=null;
 if(input.topic==='catalog_details'){const p=await getDoc(doc(db,'products',input.productIds[0]));if(p.exists())product=p.data();}
 return publicFacts(input.topic,product,site.exists()?site.data():{});
}
