import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('let AC=null,MASTER=null;'),html.indexOf('/* taps + dive */'));
test('sound awaits resume from suspended/interrupted, recreates closed contexts and respects mute',async()=>{
 let created=0,plays=0;
 class Audio {
  constructor(){this.state='interrupted';this.currentTime=0;this.destination={};created++;}
  createGain(){return{gain:{value:.55,setValueAtTime(value){this.value=value}},connect(){}};}
  async resume(){await Promise.resolve();this.state='running';}
 }
 const context=vm.createContext({window:{AudioContext:Audio},PREFS:{sound:true},addEventListener(){},showToast(){}});
 vm.runInContext(source,context);
 context.record=state=>{assert.equal(state,'running');plays++;};
 vm.runInContext("SFX_SYN.tap=(c)=>record(c.state)",context);
 assert.equal(await vm.runInContext("sfx('tap')",context),true);assert.equal(plays,1);
 vm.runInContext("AC.state='suspended'",context);await vm.runInContext("sfx('tap')",context);assert.equal(plays,2);
 vm.runInContext("AC.state='closed'",context);await vm.runInContext("sfx('tap')",context);assert.equal(created,2);
 vm.runInContext('PREFS.sound=false;applySoundPreference()',context);
 assert.equal(await vm.runInContext("sfx('tap')",context),false);assert.equal(plays,3);assert.equal(vm.runInContext('MASTER.gain.value',context),0);
});
