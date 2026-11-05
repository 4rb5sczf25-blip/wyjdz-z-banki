import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const sessionSource = await readFile(new URL('../account-session.js', import.meta.url), 'utf8');
const dataSource = await readFile(new URL('../account-data.js', import.meta.url), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const member = (uid, exp = Date.now()+3600000) => ({uid,at:'test-'+uid,rt:'refresh-'+uid,exp,anonymous:false});
function app(fetcher = async () => new Response('[]')) {
  const values = new Map(), tasks = new Map(); let next = 0;
  const localStorage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,String(value)), removeItem: key => values.delete(key) };
  const ctx = vm.createContext({ localStorage, fetch: (...args) => fetcher(...args), AbortController, DOMException, Date, crypto, navigator:{onLine:true},
    setTimeout: fn => { const id=++next;tasks.set(id,fn);return id; },clearTimeout:id=>tasks.delete(id),
    document:{addEventListener(){}},addEventListener(){},profileName:v=>v||'', render(){},current:'Main' });
  vm.runInContext(sessionSource+'\n'+dataSource,ctx);
  const run = code => vm.runInContext(code,ctx);
  run('initAccountData()');
  return {ctx,run,values,tasks,localStorage,login:uid=>ctx.sbStore(member(uid))};
}
function cloud() {
  let row = null; const calls=[];
  return {calls,get row(){return row},set row(value){row=value},fetcher:async(url, options)=>{
    calls.push({url,options});const parsed=new URL(url);
    if(options.method==='GET') return Response.json(row?[structuredClone(row)]:[]);
    const body=JSON.parse(options.body);
    if(options.method==='PATCH') {
      if(parsed.searchParams.get('updated_at')!=='eq.'+row.updated_at)return Response.json([]);
      row={...row,...body};return Response.json([row]);
    }
    if(options.method==='POST') { if(row)return Response.json([]);row=body;return Response.json([row]); }
    throw new Error('unexpected request');
  }};
}
test('account switching and reload keep saved data isolated; unowned legacy data is quarantined',()=>{
  const a=app();a.localStorage.setItem('wzb-saved','[99]');a.localStorage.removeItem('wzb-data-owner');
  a.run('initAccountData()');assert.match(a.values.get('wzb-legacy-data'),/99/);
  a.login('A');a.run("accountWrite('wzb-saved',[1])");a.ctx.sbStore(null);
  assert.deepEqual(JSON.parse(a.values.get('wzb-saved')),[]);
  a.login('B');assert.deepEqual(JSON.parse(a.values.get('wzb-saved')),[]);
  a.run("accountWrite('wzb-saved',[2])");a.login('A');assert.deepEqual(JSON.parse(a.values.get('wzb-saved')),[1]);
  a.run('initAccountData()');assert.deepEqual(JSON.parse(a.values.get('wzb-saved')),[1]);
});
test('concurrent token requests share one refresh; late refresh cannot undo logout or replace another account',async()=>{
  for(const next of [null,member('B')]){
    const reply=deferred();let requests=0;
    const a=app(async()=>{requests++;return reply.promise});a.ctx.sbStore(member('A',0));
    const first=a.ctx.sbToken(),second=a.ctx.sbToken();assert.equal(requests,1);
    a.ctx.sbStore(next);
    reply.resolve(Response.json({access_token:'new',refresh_token:'new-rt',user:{id:'A'}}));
    assert.deepEqual(await Promise.all([first,second]),[null,null]);assert.equal(a.ctx.sbSession()?.uid,next?.uid);
  }
});
test('refresh rejection for old account never clears a newly logged-in account',async()=>{
  const reply=deferred();const a=app(()=>reply.promise);a.ctx.sbStore(member('A',0));const pending=a.ctx.sbToken();
  a.login('B');reply.resolve(Response.json({message:'expired'},{status:401}));await pending;assert.equal(a.ctx.sbSession().uid,'B');
});
test('transport timeout covers body read, clears pending timer and does not discard a valid session',async()=>{
  const a=app((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason))));a.login('A');
  const pending=a.ctx.sbReq('/auth/v1/user',{token:'test'});
  const timeout=[...a.tasks.values()].at(-1);timeout();await assert.rejects(pending,{name:'TimeoutError'});assert.equal(a.ctx.sbSession().uid,'A');
});
test('saved deletion propagates and concurrent remote additions survive; reset synchronises zero values',async()=>{
  const c=cloud(),a=app(c.fetcher);a.login('A');a.run("accountWrite('wzb-saved',[1,2])");assert.equal(await a.ctx.syncNow(),true);
  c.row.data['wzb-saved'].push(3);c.row.updated_at='2030-01-01T00:00:00.000Z';
  a.run("accountWrite('wzb-saved',[2])");assert.equal(await a.ctx.syncNow(),true);
  assert.deepEqual(c.row.data['wzb-saved'],[2,3]);assert.deepEqual(JSON.parse(a.values.get('wzb-saved')),[2,3]);
  a.run('resetAccountProgress()');assert.equal(await a.ctx.syncNow(),true);assert.deepEqual(c.row.data['wzb-saved'],[]);assert.equal(c.row.data['wzb-stats'].analyses,0);
});
test('sync calls are deduplicated before refresh; old read cannot apply or upload data after switching account',async()=>{
  const reply=deferred();let requests=0;const a=app(()=>{requests++;return reply.promise});a.login('A');
  const first=a.ctx.syncNow(),second=a.ctx.syncNow();await Promise.resolve();assert.equal(requests,1);
  a.login('B');a.run("accountWrite('wzb-saved',[22])");reply.resolve(Response.json([{data:{'wzb-saved':[11]},updated_at:'2026-01-01T00:00:00Z'}]));
  assert.deepEqual(await Promise.all([first,second]),[false,false]);assert.deepEqual(JSON.parse(a.values.get('wzb-saved')),[22]);assert.equal(requests,1);
});
test('conflicting remote write is retried without dropping either devices additions',async()=>{
  const c=cloud();c.row={data:{'wzb-saved':[1]},updated_at:'2026-01-01T00:00:00Z'};let raced=false, enabled=false;
  const a=app(async(url,options)=>{
    if(enabled&&options.method==='PATCH'&&!raced){raced=true;c.row.data['wzb-saved'].push(3);c.row.updated_at='2026-01-02T00:00:00Z';}
    return c.fetcher(url,options);
  });a.login('A');await a.ctx.syncNow();enabled=true;a.run("accountWrite('wzb-saved',[1,2])");
  assert.equal(await a.ctx.syncNow(),true);assert.deepEqual(c.row.data['wzb-saved'],[1,3,2]);
});
test('edits made during sync remain dirty and are rebased without double-counting statistics',async()=>{
  const c=cloud(),write=deferred();let pause=false;
  const a=app(async(url,options)=>{if(pause&&options.method==='PATCH'){pause=false;await write.promise;}return c.fetcher(url,options)});
  a.login('A');await a.ctx.syncNow();
  a.run("accountWrite('wzb-stats',{...emptyProgress(),analyses:1})");
  c.row.data['wzb-stats'].analyses=4;pause=true;
  const pending=a.ctx.syncNow();await Promise.resolve();await Promise.resolve();await new Promise(r=>setImmediate(r));
  a.run("accountWrite('wzb-stats',{...emptyProgress(),analyses:2})");write.resolve();assert.equal(await pending,true);
  assert.equal(JSON.parse(a.values.get('wzb-stats')).analyses,6);
  assert.equal(await a.ctx.syncNow(),true);assert.equal(c.row.data['wzb-stats'].analyses,6);
});
test('feedback awaits acknowledgement and reports server failures',async()=>{
  const a=app(async()=>Response.json({message:'denied'},{status:403}));await assert.rejects(()=>a.ctx.sbFeedback({rating:5}),/denied/);
  const b=app(async()=>new Response(null,{status:201}));await b.ctx.sbFeedback({rating:5});
});

test('lost acknowledgement after cloud commit does not count progress twice, including across reload',async()=>{
  const c=cloud();let loseReply=false;
  const a=app(async(url,options)=>{const result=await c.fetcher(url,options);if(loseReply&&options.method==='PATCH'){loseReply=false;throw new TypeError('connection lost after commit');}return result});
  a.login('A');await a.ctx.syncNow();a.run("accountWrite('wzb-stats',{...emptyProgress(),analyses:1})");
  loseReply=true;assert.equal(await a.ctx.syncNow(),false);assert.equal(c.row.data['wzb-stats'].analyses,1);
  a.run('initAccountData()');a.run("accountWrite('wzb-stats',{...emptyProgress(),analyses:2})");
  assert.equal(await a.ctx.syncNow(),true);assert.equal(JSON.parse(a.values.get('wzb-stats')).analyses,2);
  assert.equal(await a.ctx.syncNow(),true);assert.equal(c.row.data['wzb-stats'].analyses,2);
});

test('refresh rechecks session after acquiring the cross-tab lock and reuses another tab refresh',async()=>{
  let requests=0;const a=app(async()=>{requests++;throw new Error('must not refresh twice')});a.ctx.sbStore(member('A',0));
  a.ctx.navigator.locks={request:async(_name,work)=>{a.localStorage.setItem('wzb-session',JSON.stringify({...member('A'),at:'refreshed-in-another-tab'}));return work()}};
  assert.equal(await a.ctx.sbToken(),'refreshed-in-another-tab');assert.equal(requests,0);
});
test('timeout remains active while reading the response body',async()=>{
  const body=deferred();const a=app(async(_url,{signal})=>{signal.addEventListener('abort',()=>body.reject(signal.reason));return{ok:true,status:200,text:()=>body.promise}});
  const pending=a.ctx.sbReq('/auth/v1/user');await new Promise(r=>setImmediate(r));
  [...a.tasks.values()].at(-1)();await assert.rejects(pending,{name:'TimeoutError'});assert.equal(a.run('accountRequests.size'),0);
});
