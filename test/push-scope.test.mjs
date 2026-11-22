import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sign,sendingEnabled,testUid} from '../server/security.mjs';
import {makeHandler} from '../api/push.js';
const UID='test-customer-uid-0000001';
process.env.PUSH_SESSION_SECRET='isolated-fixture-session-secret-for-testing-only-000000';
const response=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}});
async function invoke(action,rows){const r=response();await makeHandler({recipients:async()=>rows})({method:action==='session'?'GET':'POST',url:'/api/push?action='+action,query:{action},headers:{origin:'https://weshah-admin.vercel.app','content-type':'application/json',cookie:'__Host-weshahPush='+sign({kind:'admin',exp:Date.now()+10000,jti:'scope'})},body:{type:'product',title:'Test',body:'Fixture only'}},r);return r;}
test('enable flag alone never enables sending without an exact valid test UID',()=>{
 assert.equal(sendingEnabled({PUSH_SEND_ENABLED:'true'}),false);
 assert.equal(sendingEnabled({PUSH_SEND_ENABLED:'true',PUSH_TEST_UID:'bad'}),false);
 assert.equal(testUid({PUSH_TEST_UID:UID}),UID);
 assert.equal(sendingEnabled({PUSH_SEND_ENABLED:'true',PUSH_TEST_UID:UID}),true);
 assert.equal(sendingEnabled({PUSH_SEND_ENABLED:'false',PUSH_TEST_UID:UID}),false);
});
test('session remains disabled when only the send flag is enabled',async()=>{
 delete process.env.PUSH_TEST_UID;process.env.PUSH_SEND_ENABLED='true';
 const r=await invoke('session',[]);assert.equal(r.body.sendingEnabled,false);
});
test('a mixed or wrong-account storage result fails closed before preview/send',async()=>{
 process.env.PUSH_TEST_UID=UID;process.env.PUSH_SEND_ENABLED='true';
 for(const action of ['preview','send'])for(const rows of [[{id:'other',uid:'different-customer-00000001'}],[{id:'own',uid:UID},{id:'other',uid:'different-customer-00000001'}]]){
  const r=await invoke(action,rows);assert.equal(r.statusCode,503);assert.equal(r.body.error,'Test audience is not isolated');
 }
});
test('the exact account can be previewed while sends remain disabled',async()=>{
 process.env.PUSH_TEST_UID=UID;process.env.PUSH_SEND_ENABLED='false';
 const r=await invoke('preview',[{id:'only',uid:UID}]);assert.equal(r.statusCode,200);assert.equal(r.body.count,1);assert.equal(r.body.sendingEnabled,false);assert.equal(r.body.testOnly,true);
});
