import test from 'node:test';
import assert from 'node:assert/strict';
import '../analysis-method.js';
const M=globalThis.AnalysisMethod;
test('sampling spans beginning middle and end deterministically, with original offsets and no rewritten text',()=>{
  const text=Array.from({length:30},(_,i)=>`Zdanie numer ${i+1} opisuje zdarzenie.`).join(' ');
  const sample=M.sampleText(text,'Tytuł testowy');
  assert.equal(sample.units.length,12);assert.equal(sample.units[0].kind,'title');
  const body=sample.units.filter(u=>u.kind==='body');assert.equal(body[0].sentence,1);assert.equal(body.at(-1).sentence,30);assert.ok(body.some(u=>u.sentence>=13&&u.sentence<=18));
  for(const row of body)assert.equal(text.slice(row.start,row.end),row.text);
  assert.equal(sample.partial,true);assert.deepEqual(sample,M.sampleText(text,'Tytuł testowy'));
  const long=M.sampleText('Bardzo długie zdanie '.repeat(80));assert.ok(long.units.every(u=>u.text.length<=300));
});
test('independent flags do not dilute peak severity and quote emotion is separated from author',()=>{
  const rows=Array.from({length:10},(_,i)=>({id:i+1,kind:'body',checkable:true,opinion:i===0,emotion:i<2?3:0,voice:i<2?'quoted':'none'}));
  rows.push({id:0,kind:'title',checkable:false,opinion:true,emotion:3,voice:'author'});
  const summary=M.summarize(rows);assert.equal(summary.emotional,2);assert.equal(summary.analyzed,10);assert.equal(summary.peak,3);assert.equal(summary.authorPeak,0);assert.equal(summary.quotedEmotional,2);assert.equal(summary.checkable,10);assert.equal(summary.coverage,20);
});
test('model output is bound to every selected ID, original text and literal supporting cue',()=>{
  const sample=M.sampleText('Za kompromitującą ustawą zagłosowało 231 posłów. Projekt trafił do komisji.');
  const rows=sample.units.map(u=>({id:u.id,checkable:true,opinion:u.id===1,emotion:u.id===1?3:0,voice:u.id===1?'author':'none',cue:u.id===1?'kompromitującą':'',reason:'Ocena języka, nie weryfikacja.'}));
  assert.equal(M.validateRows({sentences:rows},sample)[0].text,sample.units[0].text);
  for(const bad of [rows.slice(0,1),[rows[0],rows[0]],rows.map(r=>({...r,id:999})),rows.map(r=>({...r,cue:'wymyślony fragment'}))])assert.throws(()=>M.validateRows({sentences:bad},sample));
});
test('local fallback exposes mixed labels and uncertainty about quoted speech without pretending AI',()=>{
  const r=M.analyzeLocal('Za tą kompromitującą ustawą zagłosowało 231 posłów. „To skandal!” powiedział radny.');
  assert.equal(r.analysisVersion,2);assert.equal(r.ai,false);assert.equal(r.rows[0].checkable,true);assert.equal(r.rows[0].opinion,true);assert.equal(r.rows[0].emotion,3);
  assert.ok(r.rows.some(row=>row.voice==='uncertain'));assert.equal(r.summary.authorPeak,3);
});
