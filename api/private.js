import {ADMIN,HttpError,fail,session} from '../server/security.mjs';
import {privateRequest} from '../server/private-data.mjs';
import * as storage from '../server/private-storage.mjs';
export function makePrivateHandler(deps=storage){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
 try{
  if(req.method!=='POST')fail(405,'Method not allowed');
  if(req.headers.origin!==ADMIN)fail(403,'Use the administration website');
  const actor=session(req.headers.cookie);if(!actor)fail(401,'Sign in using the existing administration login');
  if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON required');
  let body=req.body;if(typeof body==='string'){if(Buffer.byteLength(body)>1048576)fail(413,'Request too large');try{body=JSON.parse(body);}catch{fail(400,'Invalid JSON');}}
  if(!body||Buffer.byteLength(JSON.stringify(body))>1048576)fail(413,'Request too large');
  const input=privateRequest(body);await deps.rate('private:admin:'+actor.jti,180,60000);
  const result=['list','get'].includes(input.action)?await deps.readPrivate(input):await deps.writePrivate(input);
  return res.status(200).json(result);
 }catch(e){return res.status(e instanceof HttpError?e.status:503).json({error:e instanceof HttpError?e.message:'Private data is temporarily unavailable. No automatic retry was made.'});}
};}
export default makePrivateHandler();
