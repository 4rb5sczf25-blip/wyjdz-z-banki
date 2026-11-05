import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../quota-view.js',import.meta.url),'utf8');
test('counter shows specific server errors without fabricating remaining quota',async()=>{
  for(const message of ['Serwer nie ma uprawnień. Kod: quota_read_denied.','Sesja wygasła. Zaloguj się ponownie.']){
    const el={textContent:''};
    const ctx=vm.createContext({document:{getElementById:()=>el},sbSession:()=>({uid:'test'}),sbToken:async()=>'test-token',fetch:async()=>({ok:false,status:503,json:async()=>({error:message})}),AbortSignal,addEventListener:()=>{},setInterval:()=>{}});
    vm.runInContext(source,ctx);await vm.runInContext('refreshAnalysisQuota()',ctx);assert.equal(el.textContent,message);
  }
});
