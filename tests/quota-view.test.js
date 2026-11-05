import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../quota-view.js',import.meta.url),'utf8');
test('counter shows specific server errors without fabricating remaining quota',async()=>{
  for(const message of ['Serwer nie ma uprawnień. Kod: quota_read_denied.','Sesja wygasła. Zaloguj się ponownie.']){
    const el={textContent:''};
    const ctx=vm.createContext({AbortController,DOMException,setTimeout,clearTimeout,performance,document:{getElementById:()=>el},sbSession:()=>({uid:'test'}),sbToken:async()=>'test-token',fetch:async()=>({ok:false,status:503,json:async()=>({error:message})}),AbortSignal,addEventListener:()=>{},setInterval:()=>{}});
    vm.runInContext(source,ctx);await vm.runInContext('refreshAnalysisQuota()',ctx);assert.equal(el.textContent,message);
  }
});

test('expired session leaves a clear message instead of an endless loading counter',async()=>{
  let session={uid:'A'};const el={textContent:''};
  const ctx=vm.createContext({AbortController,DOMException,setTimeout,clearTimeout,performance,document:{getElementById:()=>el},sbSession:()=>session,sbToken:async()=>{session=null;return null},fetch:()=>{throw new Error('must not fetch')},addEventListener(){},setInterval(){}});
  vm.runInContext(source,ctx);await ctx.refreshAnalysisQuota();assert.match(el.textContent,/Sesja wygasła/);assert.doesNotMatch(el.textContent,/Sprawdzam/);
});
test('valid server quota is accepted despite wrong device date; old response cannot replace another user count',async()=>{
  const el={textContent:''};let session={uid:'A'},finish;
  const ctx=vm.createContext({AbortController,DOMException,setTimeout,clearTimeout,performance,document:{getElementById:()=>el},sbSession:()=>session,sbToken:async()=>'test',fetch:()=>new Promise(resolve=>{finish=resolve}),addEventListener(){},setInterval(){}});
  vm.runInContext(source,ctx);const first=ctx.refreshAnalysisQuota();await new Promise(resolve=>setImmediate(resolve));
  finish({ok:true,json:async()=>({day:'2020-01-01',limit:2,remaining:1,serverTime:'2020-01-01T23:00:00Z',resetsAt:'2020-01-02T00:00:00Z'})});await first;assert.match(el.textContent,/1 z 2/);
  const pending=ctx.refreshAnalysisQuota();await new Promise(resolve=>setImmediate(resolve));session={uid:'B'};el.textContent='konto B';finish({ok:true,json:async()=>({day:'2020-01-01',limit:2,remaining:0})});await pending;assert.equal(el.textContent,'konto B');
});
