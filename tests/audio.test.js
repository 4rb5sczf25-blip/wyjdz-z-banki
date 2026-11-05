import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('const SOUND_GAIN='),html.indexOf('/* End sound support. */'));
test('sound awaits resume from suspended/interrupted, recreates closed contexts and respects mute',async()=>{
 let created=0,plays=0;
 class Audio {
  constructor(){this.state='interrupted';this.currentTime=0;this.destination={};created++;}
  createGain(){return{gain:{value:.55,setValueAtTime(value){this.value=value}},connect(){}};}
  async resume(){await Promise.resolve();this.state='running';}
 }
 const context=vm.createContext({window:{AudioContext:Audio},PREFS:{sound:true},document:{hidden:false,addEventListener(){}},performance,setTimeout,clearTimeout,addEventListener(){},showToast(){}});
 vm.runInContext(source,context);
 context.record=state=>{assert.equal(state,'running');plays++;};
 vm.runInContext("SFX_SYN.tap=(c)=>record(c.state)",context);
 assert.equal(await vm.runInContext("sfx('tap')",context),true);assert.equal(plays,1);
 vm.runInContext("AC.state='suspended'",context);await vm.runInContext("sfx('tap')",context);assert.equal(plays,2);
 vm.runInContext("AC.state='closed'",context);await vm.runInContext("sfx('tap')",context);assert.equal(created,2);
 vm.runInContext('PREFS.sound=false;applySoundPreference()',context);
 assert.equal(await vm.runInContext("sfx('tap')",context),false);assert.equal(plays,3);assert.equal(vm.runInContext('MASTER.gain.value',context),0);
});

test('late taps are dropped and a stalled audio wake is retried on the next gesture',async()=>{
 let clock=0,created=0,plays=0,release;
 class Audio {
  constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.generation=++created;}
  createGain(){return{gain:{value:.14},connect(){}};}
  resume(){if(this.generation===1)return new Promise(resolve=>{release=()=>{this.state='running';resolve()}});this.state='running';return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
 }
 const ctx=vm.createContext({window:{AudioContext:Audio},PREFS:{sound:true},document:{hidden:false,addEventListener(){}},performance:{now:()=>clock},setTimeout:(fn)=>setTimeout(fn,10),clearTimeout,addEventListener(){},showToast(){},record:()=>{plays++}});
 vm.runInContext(source,ctx);vm.runInContext('SFX_SYN.tap=()=>record()',ctx);
 const pending=vm.runInContext("sfx('tap')",ctx);clock=200;release();assert.equal(await pending,false);assert.equal(plays,0);
 vm.runInContext("AC.state='suspended'",ctx);await vm.runInContext("sfx('tap')",ctx);
 vm.runInContext("unlockAudio({type:'pointerdown'})",ctx);await Promise.resolve();
 assert.equal(created,2);assert.equal(await vm.runInContext("sfx('tap')",ctx),true);assert.equal(plays,1);
 vm.runInContext("document.hidden=true",ctx);assert.equal(await vm.runInContext("sfx('tap')",ctx),false);
});

test('finished effects release audio nodes and muting stops active sources',()=>{
 const ctx=vm.createContext({window:{},PREFS:{sound:true},document:{hidden:false,addEventListener(){}},performance,setTimeout,clearTimeout,addEventListener(){},showToast(){}});
 vm.runInContext(source,ctx);
 const values=vm.runInContext(`(()=>{let disconnected=0,stopped=0;const source={disconnect(){disconnected++},stop(){stopped++}},gain={disconnect(){disconnected++}};trackAudioSource(source,[source,gain]);source.onended();const released=ACTIVE_AUDIO_SOURCES.size;trackAudioSource(source,[source,gain]);stopActiveAudio();return{disconnected,stopped,released,active:ACTIVE_AUDIO_SOURCES.size}})()`,ctx);
 assert.equal(values.released,0);assert.equal(values.active,0);assert.equal(values.stopped,1);assert.ok(values.disconnected>=2);
});
