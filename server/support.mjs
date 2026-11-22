import {HttpError,fail} from './security.mjs';
export const MODEL='@cf/qwen/qwen3.8-27b';
export const TOPICS=['catalog_details','shipping_policy','returns_policy','payment_help','contact_human'];
export const UNAVAILABLE='مساعد وشاح غير متاح حاليًا. لم يتم إرسال أي طلب دعم أو تنفيذ أي إجراء. جرّب لاحقًا.';
const number=(v,max=10000000)=>{if(typeof v==='string'&&/^\d{1,8}(\.\d{1,2})?$/.test(v))v=Number(v);return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?Math.round(v*100)/100:null};
const currencies=new Map([['ج.م','ج.م'],['EGP','ج.م'],['جنيه مصري','ج.م'],['USD','دولار أمريكي'],['SAR','ريال سعودي'],['AED','درهم إماراتي'],['EUR','يورو']]);
export function enabled(env=process.env){return env.WESHAH_AI_ENABLED==='true'&&env.CLOUDFLARE_AI_MODEL===MODEL&&/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID||'')&&!!env.CLOUDFLARE_API_TOKEN;}
export function request(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['topic','productIds'].includes(k))||!TOPICS.includes(value.topic))fail(400,'اختر موضوعًا من موضوعات المساعد. لا تُرسل نصوصًا أو بيانات شخصية.');
 const ids=value.productIds??[];
 if(!Array.isArray(ids)||ids.length>1||ids.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(id))||(value.topic==='catalog_details'&&ids.length!==1)||(value.topic!=='catalog_details'&&ids.length))fail(400,'اختر منتجًا منشورًا واحدًا عند السؤال عن المنتج.');
 return {topic:value.topic,productIds:ids};
}
// Only typed public numerical fields cross the provider boundary. Names,
// descriptions, contacts, addresses, policy text, IDs and customer text do not.
export function publicFacts(topic,product,settings={}){
 const currency=currencies.get(settings.accounting?.currency??'ج.م')??null;
 if(topic==='catalog_details'){
  if(!product||!['active','published',''].includes(product.status??'active')||product.hidden===true||product.published===false||product.isActive===false)fail(404,'المنتج غير متاح لهذا المساعد.');
  const price=number(product.price);let priceMin=price,priceMax=price,stock=null;
  if(Array.isArray(product.variants)&&product.variants.length){
   if(product.variants.length>100)fail(404,'راجع خيارات المنتج من صفحته.');
   const prices=product.variants.map(v=>number(v?.price)>0?number(v.price):price);
   if(prices.every(v=>v!==null)){priceMin=Math.min(...prices);priceMax=Math.max(...prices);}else priceMin=priceMax=null;
   const stocks=product.variants.map(v=>number(v?.stock,100000));
   if(product.trackStock!==false&&stocks.every(v=>v!==null))stock=stocks.reduce((s,v)=>s+Math.round(v),0);
  }else if(product.trackStock!==false){const v=number(product.stock,100000);if(v!==null)stock=Math.round(v);}
  return {priceMin:currency?priceMin:null,priceMax:currency?priceMax:null,currency,stock};
 }
 if(topic==='shipping_policy'){const sf=settings.storefront??{};return {shippingFee:currency?number(sf.shippingFee):null,freeShippingOver:currency?number(sf.freeShippingOver):null,currency};}
 return {};
}
export function candidates(topic,facts){
 let answer,handoff=false;
 if(topic==='catalog_details'){
  const price=facts.priceMin===null?'السعر غير مؤكد من هنا.':facts.priceMin===facts.priceMax?`السعر المنشور للمنتج المحدد ${facts.priceMin} ${facts.currency}.`:`أسعار خيارات المنتج من ${facts.priceMin} إلى ${facts.priceMax} ${facts.currency}.`;
  const stock=facts.stock===null?'المخزون غير مؤكد من هنا.':`المخزون المسجل وقت السؤال ${facts.stock} قطعة.`;
  answer=`${price} ${stock} راجع الخيار المطلوب والسعر النهائي قبل تأكيد الطلب. هذه المعلومات ليست حجزًا للمخزون.`;handoff=facts.priceMin===null||facts.stock===null;
 }else if(topic==='shipping_policy'){
  const fee=facts.shippingFee===null?'رسوم الشحن غير مؤكدة من هنا.':`رسوم الشحن المضبوطة في المتجر ${facts.shippingFee} ${facts.currency}.`;
  const free=facts.freeShippingOver>0?` حد الشحن المجاني المضبوط ${facts.freeShippingOver} ${facts.currency}.`:'';
  answer=fee+free+' لا يوجد موعد توصيل مؤكد من هذا المساعد. راجع الإجمالي المعروض قبل تأكيد الطلب.';handoff=true;
 }else if(topic==='returns_policy'){answer='المساعد لا يقرر قبول الاسترجاع أو مدته ولا ينفذ رد أموال. راجع سياسة المنتج المنشورة، إن وجدت، وتحقق من الشروط مع إدارة المتجر. لم يتم إرسال طلب استرجاع.';handoff=true;
 }else if(topic==='payment_help'){answer='المساعد لا يؤكد وصول تحويل ولا يطلب بيانات بطاقة أو إيصالًا. صورة التحويل لا تثبت استلام المال. راجع طريقة الدفع والإجمالي المعروضين قبل تأكيد الطلب. لم يتم تنفيذ دفع أو تعديل رصيد.';handoff=true;
 }else{answer='التواصل مع شخص أو إرسال تذكرة دعم غير متاح من داخل هذا المساعد حاليًا. يمكنك فتح حسابك لمراجعة طلباتك. لم يتم إرسال أي رسالة.';handoff=true;}
 return [{answer,handoff},{answer:'للتوضيح: '+answer,handoff}];
}
export function providerRequest(topic,facts,answers){
 return {messages:[{role:'system',content:'أنت مساعد وشاح التجريبي. اختر ردًا واحدًا فقط من approvedAnswers وانسخه حرفيًا كما هو، مع قيمة handoff المرفقة به. كل الردود المعتمدة تخص الموضوع الحالي. أعد كائن JSON واحدًا بمفتاحي answer وhandoff فقط. لا تضف كلمات أو حقولًا أو روابط أو تنسيقًا. لا توجد أدوات أو صلاحيات لتنفيذ أي إجراء. لا تطلب بيانات شخصية. البيانات الرقمية المعطاة مرجع فقط.'},{role:'user',content:JSON.stringify({topic,publicFacts:facts,approvedAnswers:answers})}],reasoning_effort:'low',max_completion_tokens:350,temperature:0,stream:false,store:false};
}
export function finalAnswer(data,answers){
 if(data?.success!==true)throw new Error('provider');
 let text=data?.result?.choices?.[0]?.message?.content;
 if(typeof text!=='string'||text.length>3000)throw new Error('format');
 text=text.trim();const fence=text.match(/^```json\s*\n([\s\S]*?)\n```$/);if(fence)text=fence[1].trim();
 const parsed=JSON.parse(text);
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).length!==2||!Object.hasOwn(parsed,'answer')||!Object.hasOwn(parsed,'handoff')||typeof parsed.answer!=='string'||!parsed.answer.length||parsed.answer.length>1200||typeof parsed.handoff!=='boolean'||/[<>\u0000-\u001f\u007f]|https?:|www\./i.test(parsed.answer))throw new Error('schema');
 const allowed=answers.find(a=>a.answer===parsed.answer&&a.handoff===parsed.handoff);if(!allowed)throw new Error('ungrounded');
 return {answer:allowed.answer,handoff:allowed.handoff};
}
export async function infer(topic,facts,env=process.env,fetcher=fetch){
 const answers=candidates(topic,facts);
 const r=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`,{method:'POST',headers:{Authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(providerRequest(topic,facts,answers)),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error('provider');
 const raw=await r.text();if(raw.length>64000)throw new Error('provider');
 return finalAnswer(JSON.parse(raw),answers);
}
export {HttpError};
