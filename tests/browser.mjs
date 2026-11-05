import '../analysis-method.js';
// Real Chromium UI, entirely local HTTP fixtures. No OpenAI/Supabase network calls.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const calls = [];
let extractionFails = false, analysisFails = false;
let guestAI = 0;
const articleText = 'Sejm przyjął nową ustawę dotyczącą transportu regionalnego. Moim zdaniem to dobry pomysł. To skandal! </textarea><img src=x onerror="window.injected=true">';
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/quota') {
      const token=req.headers.authorization;
      const limit=token==='Bearer guest.jwt.token'?2:5;
      const used=calls.filter(c=>c.path==='/api/analyze'&&c.auth===token).length;
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({day:new Date().toISOString().slice(0,10),limit,remaining:Math.max(0,limit-used)}));return;
    }
    if (req.url.startsWith('/api/')) {
      let raw = ''; for await (const part of req) raw += part;
      const body = JSON.parse(raw); calls.push({ path: req.url, body, auth: req.headers.authorization });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/analyze' && req.headers.authorization === 'Bearer guest.jwt.token' && ++guestAI > 2) { res.statusCode = 429; res.end(JSON.stringify({ error: 'Limit gościa: 2 analizy AI dziennie. Zaloguj się.' })); return; }
      if ((req.url === '/api/article' && extractionFails) || (req.url === '/api/analyze' && analysisFails)) {
        res.statusCode = 429; res.end(JSON.stringify({ error: 'Limit testowy. Wklej tekst ręcznie.' })); return;
      }
      res.end(JSON.stringify(req.url === '/api/article'
        ? { title: '<img onerror="window.injected=true">', url: body.url, text: articleText, truncated: true }
        : { ...globalThis.AnalysisMethod.analyzeLocal(body.text,body.title), ai: true }));
      return;
    }
    const files = { '/': 'index.html', '/article-flow.js': 'article-flow.js', '/auth-return.js': 'auth-return.js', '/guest-session.js': 'guest-session.js', '/quota-view.js': 'quota-view.js', '/profile.js': 'profile.js', '/privacy-config.js': 'privacy-config.js', '/privacy.js': 'privacy.js', '/transparency.js': 'transparency.js', '/visual-polish.js': 'visual-polish.js', '/visual-polish.css': 'visual-polish.css', '/analysis-method.js': 'analysis-method.js', '/analysis-details.js': 'analysis-details.js', '/analysis-details.css': 'analysis-details.css', '/logo.jpg': 'logo.jpg', '/favicon.png': 'favicon.png', '/manifest.webmanifest': 'manifest.webmanifest' };
    const file = files[req.url];
    if (!file) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream');
    res.end(await readFile(new URL(file, root)));
  } catch { res.statusCode = 500; res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'wzb-ui-'));
const browser = spawn(process.env.CHROMIUM_BIN || 'chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  let stderr = '';
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chromium startup timeout: ' + stderr.slice(-1000))), 10000);
    browser.on('error', reject);
    browser.stderr.on('data', chunk => { stderr += chunk; const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderr); if (match) { clearTimeout(timeout); resolve(match[1]); } });
  });
  const debugOrigin = endpoint.replace(/^ws:/, 'http:').split('/devtools')[0];
  const tabs = await (await fetch(debugOrigin + '/json')).json();
  socket = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(resolve => socket.onopen = resolve);
  let next = 0; const pending = new Map(); const exceptions = [];
  socket.onmessage = e => {
    const message = JSON.parse(e.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.id) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result); }
  };
  const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const response = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(50); }
    throw new Error('Timed out: ' + expression);
  };
  await command('Runtime.enable'); await command('Page.enable'); await command('Network.enable');
  await command('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*supabase.co*'] });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `const originalFetch=window.fetch.bind(window);window.guestSignups=0;window.profileRequests=[];window.fetch=async(input,options)=>{
if(String(input).includes('.supabase.co/auth/v1/user')&&options?.method==='PUT'){const body=JSON.parse(options.body);window.profileRequests.push(body);return new Response(JSON.stringify({id:'test-user',email:'test@example.com',user_metadata:body.data}),{status:200,headers:{'Content-Type':'application/json'}})}
if(String(input).includes('.supabase.co/auth/v1/otp')){window.profileRequests.push(JSON.parse(options.body));return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}})}
if(String(input).includes('.supabase.co/auth/v1/signup')){window.guestSignups++;return new Response(JSON.stringify({access_token:'guest.jwt.token',refresh_token:'guest-refresh',expires_in:3600,user:{id:'guest-user',is_anonymous:true}}),{status:200,headers:{'Content-Type':'application/json'}})}return originalFetch(input,options)};localStorage.setItem('wzb-onboarded','1');localStorage.setItem('wzb-prefs',JSON.stringify({motion:false,sound:false,splash:false}));` });
  const main = async () => {
    await evaluate(`document.querySelectorAll('.ob-back').forEach(e=>e.remove());location.hash='Main';show('Main');PREFS.motion=false;PREFS.sound=false;localStorage.setItem('wzb-session',JSON.stringify({at:'test.jwt.token',rt:'test',uid:'test-user',exp:Date.now()+3600000}));`);
    await waitFor(`Boolean(document.getElementById('link'))`);
  };
  const submit = value => evaluate(`document.getElementById('link').value=${JSON.stringify(value)};document.querySelector('.analyze-btn').click()`);
  await command('Page.navigate', { url: origin + '/#Main' });
  await waitFor(`typeof analyzeOwnMaterial === 'function' && typeof show === 'function'`);
  await main();
  await submit('https://example.com/article');
  await waitFor(`Boolean(document.getElementById('article-preview'))`);
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/api/article'); assert.equal(calls[0].auth, 'Bearer test.jwt.token');
  assert.equal(await evaluate(`document.getElementById('article-preview').value`), articleText);
  assert.equal(await evaluate(`Boolean(window.injected)`), false);
  assert.match(await evaluate(`document.getElementById('article-note').textContent`), /skrócono/);
  console.log('PASS URL opens editable preview, truncation notice, no AI call, safe text rendering');
  const edited = 'Sprawdzony i poprawiony tekst artykułu do analizy po zatwierdzeniu.';
  await evaluate(`document.getElementById('article-preview').value=${JSON.stringify(edited)};document.getElementById('article-confirm').click();document.getElementById('article-confirm').click()`);
  await waitFor(`location.hash === '#Article'`);
  assert.equal(await evaluate(`document.getElementById('analysis-mode').textContent`),'Analiza AI');
  assert.match(await evaluate(`document.querySelector('[aria-label="Sposób analizy"]').textContent`),/nie potwierdza prawdziwości informacji/);
  await evaluate(`document.getElementById('source-details').click()`);
  assert.equal(await evaluate(`document.getElementById('source-original').href`),'https://example.com/article');
  assert.match(await evaluate(`document.querySelector('[aria-labelledby="source-details-title"]').textContent`),/Brak danych/);
  assert.equal(await evaluate(`Boolean(window.injected)`),false);
  await evaluate(`document.querySelector('[aria-labelledby="source-details-title"] [data-close]').click();document.querySelector('[aria-label="Jak działa nasza analiza?"]').click()`);
  assert.match(await evaluate(`document.querySelector('[aria-labelledby="analysis-help-title"]').textContent`),/Trzy niezależne wymiary/);
  assert.match(await evaluate(`document.querySelector('[aria-labelledby="analysis-help-title"]').textContent`),/Nie obliczamy wyniku manipulacji/);
  await evaluate(`document.querySelector('[aria-labelledby="analysis-help-title"] [data-close]').click()`);
  console.log('PASS real source link and missing metadata, escaped text, disclosed score method');
  assert.equal(calls.length, 2); assert.equal(calls[1].path, '/api/analyze'); assert.equal(calls[1].body.text, edited);
  console.log('PASS confirmation sends edited text exactly once and displays AI result');
  await main(); await waitFor(`document.getElementById('analysis-quota').textContent.includes('4 z 5')`); console.log('PASS remaining AI quota comes from server and updates after analysis'); await submit('https://example.com/cancel'); await waitFor(`Boolean(document.getElementById('article-preview'))`);
  const beforeCancel = calls.length;
  await evaluate(`document.getElementById('article-cancel').click()`); await delay(100);
  assert.equal(calls.length, beforeCancel);
  console.log('PASS cancel never starts AI');
  await main(); await submit('x'.repeat(12001)); assert.equal(calls.length, beforeCancel);
  assert.match(await evaluate(`document.getElementById('analyze-msg').textContent`), /12 000/);
  console.log('PASS oversized manual input blocked before request');
  extractionFails = true;
  await submit('https://example.com/denied'); await waitFor(`document.getElementById('analyze-msg').textContent.includes('Limit testowy')`);
  assert.equal(await evaluate(`Boolean(document.getElementById('article-preview'))`), false);
  console.log('PASS fetch/quota error offers manual input without AI');
  extractionFails = false;
  await main(); await submit(edited); await waitFor(`location.hash === '#Article'`);
  assert.equal(calls.at(-1).path, '/api/analyze'); assert.equal(calls.at(-1).body.text, edited);
  console.log('PASS manual text still uses AI');
  analysisFails = true;
  await main(); await submit(edited); await waitFor(`location.hash === '#Article'`);
  assert.equal(await evaluate(`curArticle().ai`), false);
  assert.equal(await evaluate(`document.getElementById('analysis-mode').textContent`),'Analiza lokalna');
  console.log('PASS manual AI failure preserves clearly labeled local fallback');
  await main(); await submit('https://example.com/ai-error'); await waitFor(`Boolean(document.getElementById('article-preview'))`);
  await evaluate(`document.getElementById('article-confirm').click()`);
  await waitFor(`document.getElementById('article-error').textContent.includes('Limit testowy')`);
  assert.equal(await evaluate(`document.getElementById('article-preview').value`), articleText);
  assert.equal(await evaluate(`document.getElementById('article-confirm').disabled`), false);
  console.log('PASS AI denial preserves editable preview for retry');
  analysisFails = false;
  await main(); await evaluate(`sbStore(null);location.hash='Splash';show('Splash')`);
  await evaluate(`document.getElementById('start-account').click()`);
  assert.match(await evaluate(`document.querySelector('#acBody').innerText`), /Utwórz konto/);
  await evaluate(`document.querySelector('#acBody [data-x]').click();document.getElementById('start-guest').click()`);
  await waitFor(`location.hash === '#Main' && isGuestSession()`);
  assert.equal(await evaluate(`window.guestSignups`), 1);
  console.log('PASS start screen offers login/signup and guest without email');
  await submit('https://example.com/guest');
  await waitFor(`Boolean(document.getElementById('article-preview'))`);
  assert.match(await evaluate(`document.getElementById('article-note').textContent`), /2 analizy/);
  const aiBefore = calls.filter(c=>c.path==='/api/analyze').length;
  await evaluate(`document.getElementById('article-cancel').click()`);
  assert.equal(calls.filter(c=>c.path==='/api/analyze').length, aiBefore);
  await submit(edited); await waitFor(`location.hash === '#Article'`);
  assert.equal(calls.at(-1).auth, 'Bearer guest.jwt.token');
  assert.equal(await evaluate(`curArticle().ai`), true);
  await evaluate(`location.hash='Main';show('Main')`);
  await submit(edited); await waitFor(`location.hash === '#Article'`);
  assert.equal(await evaluate(`curArticle().ai`), true);
  await evaluate(`location.hash='Main';show('Main')`);
  await submit(edited); await waitFor(`location.hash === '#Article'`);
  assert.equal(await evaluate(`curArticle().ai`), false);
  assert.equal(await evaluate(`window.guestSignups`), 1);
  await evaluate(`location.hash='Main';show('Main')`); await waitFor(`document.getElementById('analysis-quota').textContent.includes('0 z 2')`);
  console.log('PASS guest session reused; preview free; two AI analyses then local fallback');
  await main();
  await evaluate(`document.getElementById('main-account').click()`);
  await evaluate(`document.getElementById('acProfileName').value='Tester';document.getElementById('acSaveName').click()`);
  await waitFor(`sbSession().displayName==='Tester'`);
  assert.equal(await evaluate(`document.getElementById('acProfileName').value`),'Tester');
  await evaluate(`document.getElementById('acProfileName').value='';document.getElementById('acSaveName').click()`);
  await waitFor(`sbSession().displayName===''`);
  await evaluate(`document.querySelector('#acBody [data-x]').click();sbStore(null);openAccount()`);
  await evaluate(`document.getElementById('acPrivacy').click()`);
  assert.match(await evaluate(`document.querySelector('[aria-labelledby="privacy-title"]').innerText`),/Fundacja Prześwit/);
  assert.match(await evaluate(`document.querySelector('[aria-labelledby="privacy-title"]').innerText`),/prywatnosc@wyjdzzbanki.pl/);
  assert.match(await evaluate(`document.querySelector('[aria-labelledby="privacy-title"]').innerText`),/Wersja robocza/);
  await evaluate(`document.querySelector('[aria-labelledby="privacy-title"] [data-close]').click();document.getElementById('acEmail').value='new@example.com';document.getElementById('acNick').value='Nowy nick';document.getElementById('acSend').click()`);
  await waitFor(`Boolean(document.getElementById('acCode'))`);
  assert.equal(await evaluate(`window.profileRequests.at(-1).data.display_name`),'Nowy nick');
  await evaluate(`document.querySelectorAll('.ob-back').forEach(e=>e.remove());location.hash='Settings';show('Settings');document.getElementById('settings-privacy').click()`);
  assert.equal(await evaluate(`Boolean(document.getElementById('privacy-title'))`),true);
  console.log('PASS optional nickname saves/clears; signup metadata; privacy available before signup and in settings');
  await evaluate(`document.querySelectorAll('.ob-back').forEach(e=>e.remove());select({ev:0,src:null,from:'Compare'});location.hash='Compare';show('Compare')`);
  await evaluate(`document.getElementById('comparison-why').click()`);
  const comparisonHelp = await evaluate(`document.querySelector('[aria-labelledby="comparison-why-title"]').innerText`);
  assert.match(comparisonHelp,/przygotowano ręcznie/);assert.match(comparisonHelp,/fikcyjne media/);assert.match(comparisonHelp,/3 z 9/);
  await evaluate(`document.querySelector('[aria-labelledby="comparison-why-title"] [data-close]').click();select({src:'ds',from:'Compare'});location.hash='Article';show('Article');document.getElementById('source-details').click()`);
  assert.match(await evaluate(`document.querySelector('[aria-labelledby="source-details-title"]').innerText`),/postać fikcyjna/);
  assert.equal(await evaluate(`Boolean(document.getElementById('source-original'))`),false);
  await evaluate(`document.querySelector('[aria-labelledby="source-details-title"] [data-close]').click();document.querySelector('[aria-label="Jak działa nasza analiza?"]').click()`);
  assert.match(await evaluate(`document.querySelector('[aria-labelledby="analysis-help-title"]').innerText`),/ręcznie ustawioną częścią starszej makiety/);
  console.log('PASS comparison rationale and fictional metadata clearly labeled; demo URLs not clickable');
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await evaluate(`document.querySelectorAll('.ob-back').forEach(e=>e.remove());visualEntries.clear();setPref('motion',true);select({ev:0,src:null,from:'Compare'});show('Compare')`);
  assert.ok(await evaluate(`stage.firstElementChild.querySelector('.map-point').getAnimations().length>0`));
  await delay(650);
  await evaluate(`show('Compare')`);
  assert.equal(await evaluate(`stage.firstElementChild.querySelector('.map-point').getAnimations().length`),0);
  assert.equal(await evaluate(`stage.firstElementChild.querySelectorAll('.reveal-pending').length`),0);
  await evaluate(`select({src:'ds',from:'Compare'});show('Article')`);
  assert.ok(await evaluate(`stage.firstElementChild.querySelector('.result-distribution').getAnimations().length>0`));
  await evaluate(`document.getElementById('source-details').click();setPref('motion',false)`);
  assert.equal(await evaluate(`visualAnimations.size`),0);
  assert.equal(await evaluate(`pendingCards.size`),0);
  await evaluate(`document.querySelector('.app-modal [data-close]').click()`);
  assert.equal(await evaluate(`Boolean(document.querySelector('.app-modal'))`),false);
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate(`setPref('motion',true);show('Compare')`);
  assert.equal(await evaluate(`motionOK()`),false);
  assert.equal(await evaluate(`stage.firstElementChild.querySelector('.map-point').getAnimations().length`),0);
  await evaluate(`show('Main');window.restoreBusy=materialBusy(document.querySelector('.analyze-btn'),'Analizujemy język tekstu…')`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sonar-ring')).animationName`),'none');
  assert.match(await evaluate(`document.querySelector('.analyze-btn').textContent`),/Analizujemy język tekstu/);
  assert.doesNotMatch(await evaluate(`document.querySelector('.analyze-btn').textContent`),/%/);
  await evaluate(`window.restoreBusy()`);
  console.log('PASS cards/map animate once, result bar animates, motion toggle cancels effects, reduced motion shows static sonar');
  await evaluate(`document.querySelectorAll('.ob-back').forEach(e=>e.remove());setPref('motion',false);show('Main');showMaterialAnalysis(AnalysisMethod.analyzeLocal('Za tą kompromitującą ustawą zagłosowało aż 231 posłów. Projekt trafił do komisji.'),'Za tą kompromitującą ustawą zagłosowało aż 231 posłów. Projekt trafił do komisji.')`);
  await waitFor(`location.hash==='#Article' && Boolean(document.getElementById('emotion-summary'))`);
  const summaryText=await evaluate(`document.getElementById('emotion-summary').innerText`);
  assert.match(summaryText,/1 z 2 fragmentów/);assert.match(summaryText,/silne/);await evaluate(`document.querySelector('#emotion-summary details summary').click()`);assert.match(await evaluate(`document.getElementById('emotion-summary').innerText`),/Twierdzenia sprawdzalne: 2/);
  assert.ok(await evaluate(`analysisRows(curArticle())[0].checkable && analysisRows(curArticle())[0].opinion && analysisRows(curArticle())[0].emotion===3`));
  assert.equal(await evaluate(`getComputedStyle(stage.firstElementChild.querySelectorAll('.mark')[1]).backgroundColor`),'rgba(0, 0, 0, 0)');
  await evaluate(`stage.firstElementChild.querySelector('.mark').click()`);
  assert.match(await evaluate(`document.getElementById('mark-tip-body').innerText`),/Wskazany fragment/);
  console.log('PASS overlapping labels, strong emotion despite neutral scaffolding, neutral claim styling and grounded explanation');
  await main();
  await submit('https://example.com/local-choice');await waitFor(`Boolean(document.getElementById('article-local'))`);
  const paidBeforeLocal=calls.filter(c=>c.path==='/api/analyze').length;
  await evaluate(`document.getElementById('article-local').click()`);await waitFor(`location.hash==='#Article'`);
  assert.equal(await evaluate(`curArticle().ai`),false);assert.equal(calls.filter(c=>c.path==='/api/analyze').length,paidBeforeLocal);
  console.log('PASS explicit local preview action never calls paid analysis endpoint');
  await evaluate(`document.querySelectorAll('.ob-back').forEach(e=>e.remove());show('Article');const scroll=stage.firstElementChild.querySelector('.article-scroll');scroll.scrollTop=scroll.scrollHeight;const marks=stage.firstElementChild.querySelectorAll('.mark');marks[marks.length-1].click()`);
  const geometry=await evaluate(`(()=>{const modal=document.querySelector('.app-modal'),stageBox=stage.getBoundingClientRect(),box=modal.getBoundingClientRect();return{top:box.top-stageBox.top,bottom:stageBox.bottom-box.bottom,scroll:stage.firstElementChild.querySelector('.article-scroll').scrollTop,body:!!modal.querySelector('.modal-body')}})()`);
  assert.ok(geometry.top>=0);assert.ok(geometry.bottom>=-1);assert.equal(geometry.body,true);
  await evaluate(`document.querySelector('.app-modal [data-close]').click()`);
  assert.equal(await evaluate(`stage.firstElementChild.querySelector('.article-scroll').scrollTop`),geometry.scroll);
  console.log('PASS explanation is a bounded scrollable modal and preserves article scroll');
  await evaluate(`show('Settings');setPref('sound',true);document.getElementById('test-sound').scrollIntoView({block:'center'})`);
  const soundButton=await evaluate(`(()=>{const r=document.getElementById('test-sound').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...soundButton});
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...soundButton});
  await waitFor(`AC && AC.state==='running'`);
  await evaluate(`setPref('sound',false)`);assert.equal(await evaluate(`MASTER.gain.value`),0);
  console.log('PASS trusted sound-test interaction starts Web Audio and sound-off mutes the output');
  await evaluate(`setPref('sound',false);document.querySelectorAll('.ob-back').forEach(e=>e.remove());show('Main');const text='Zdaniem części ekspertów ta kwota może jednak nie wystarczyć na trwałą poprawę sytuacji.';showMaterialAnalysis(AnalysisMethod.analyzeLocal(text),text)`);
  await waitFor(`location.hash==='#Article'`);
  await evaluate(`stage.firstElementChild.querySelector('.mark').click()`);
  assert.equal(await evaluate(`document.querySelector('.explanation-quote mark').textContent`),'Zdaniem');
  assert.equal(await evaluate(`Boolean(document.querySelector('.badge-opinion'))`),true);
  assert.equal(await evaluate(`Boolean(document.querySelector('.explanation-quote .cue-opinion'))`),true);
  assert.equal(await evaluate(`Boolean(document.querySelector('.badge-emotion'))`),false);
  console.log('PASS opinion evidence highlighted in yellow with matching badge and meaningful local reason');
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await evaluate(`document.querySelector('.app-modal [data-close]').click();show('Splash');PREFS.motion=true;window.entryPromise=playEntryDive(document.getElementById('start-guest'));true`);
  await waitFor(`Boolean(document.querySelector('.entry-dive-canvas'))`);
  await waitFor(`current==='Main' && !document.querySelector('.entry-dive-canvas')`);
  assert.equal(await evaluate(`Boolean(stage.firstElementChild.inert)`),false);
  console.log('PASS restored water-and-bubbles entry reaches Main and cleans up the canvas');
  await evaluate(`document.querySelectorAll('.ob-back').forEach(e=>e.remove());setPref('motion',false);const pick=NEWS.slice(0,3).flatMap((ev,evIndex)=>ev.articles.map(a=>({evIndex,a}))).find(item=>item.a.rows.some(row=>row.kind==='title'&&row.opinion&&row.cue));select({ev:pick.evIndex,src:pick.a.id,from:'Compare'});location.hash='Article';show('Article')`);
  const beforeTitle=await evaluate(`JSON.stringify(curArticle().summary)`);
  const titleCue=await evaluate(`curArticle().rows.find(row=>row.kind==='title').cue`);
  const beforeTitleCalls=calls.filter(c=>c.path==='/api/analyze').length;
  await evaluate(`document.getElementById('analysis-headline').click()`);
  assert.match(await evaluate(`document.getElementById('fragment-explanation-title').textContent`),/nagłówek/);
  assert.equal(await evaluate(`document.querySelector('.explanation-quote mark').textContent`),titleCue);
  assert.equal(await evaluate(`Boolean(document.querySelector('.badge-opinion'))`),true);
  await evaluate(`document.querySelector('.app-modal [data-close]').click()`);
  assert.equal(await evaluate(`JSON.stringify(curArticle().summary)`),beforeTitle);
  assert.equal(calls.filter(c=>c.path==='/api/analyze').length,beforeTitleCalls);
  console.log('PASS assessed headline opens grounded explanation without altering body statistics or calling AI');
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log('22 browser scenarios passed; no real OpenAI or Supabase requests.');
} finally {
  socket?.close(); browser.kill('SIGTERM');
  await new Promise(resolve => { if (browser.exitCode !== null) resolve(); else browser.once('exit', resolve); });
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
