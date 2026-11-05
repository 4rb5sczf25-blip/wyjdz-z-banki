import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../profile.js',import.meta.url),'utf8');
test('nickname normalization and authenticated save/clear use metadata without touching email',async()=>{
  let session={uid:'test-user',at:'test',anonymous:false};const calls=[];
  const ctx=vm.createContext({ sessionVersion: () => 0, requireSessionVersion: () => {},sbSession:()=>session,isGuestSession:s=>s.anonymous,sbToken:async()=>'test',sbStore:s=>{session=s},sbReq:async(path,options)=>{calls.push({path,options});return{id:'test-user',user_metadata:options.body.data}}});
  vm.runInContext(source,ctx);
  assert.equal(vm.runInContext("profileName('  Ala\\n   Kot  ')",ctx),'Ala Kot');
  await vm.runInContext("saveProfileName('Nick')",ctx);assert.equal(session.displayName,'Nick');
  assert.equal(calls[0].path,'/auth/v1/user');assert.equal(calls[0].options.method,'PUT');assert.equal(calls[0].options.body.email,undefined);
  await vm.runInContext("saveProfileName('')",ctx);assert.equal(session.displayName,'');
  await assert.rejects(()=>vm.runInContext("saveProfileName('x'.repeat(41))",ctx),/40/);
  session.anonymous=true;await assert.rejects(()=>vm.runInContext("saveProfileName('Nick')",ctx),/Zaloguj/);
});
