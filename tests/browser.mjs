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
const articleText = 'Sejm przyjął nową ustawę dotyczącą transportu regionalnego. Moim zdaniem to dobry pomysł. To skandal! </textarea><img src=x onerror="window.injected=true">';
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      let raw = ''; for await (const part of req) raw += part;
      const body = JSON.parse(raw); calls.push({ path: req.url, body, auth: req.headers.authorization });
      res.setHeader('Content-Type', 'application/json');
      if ((req.url === '/api/article' && extractionFails) || (req.url === '/api/analyze' && analysisFails)) {
        res.statusCode = 429; res.end(JSON.stringify({ error: 'Limit testowy. Wklej tekst ręcznie.' })); return;
      }
      res.end(JSON.stringify(req.url === '/api/article'
        ? { title: '<img onerror="window.injected=true">', url: body.url, text: articleText, truncated: true }
        : { s: [['fact', body.text.slice(0, 100)]], head: 'Wynik testowy', pct: 3, ai: true }));
      return;
    }
    const files = { '/': 'index.html', '/article-flow.js': 'article-flow.js', '/logo.jpg': 'logo.jpg', '/favicon.png': 'favicon.png', '/manifest.webmanifest': 'manifest.webmanifest' };
    const file = files[req.url];
    if (!file) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream');
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
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('wzb-onboard','1');localStorage.setItem('wzb-prefs',JSON.stringify({motion:false,sound:false,splash:false}));` });
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
  assert.equal(calls.length, 2); assert.equal(calls[1].path, '/api/analyze'); assert.equal(calls[1].body.text, edited);
  console.log('PASS confirmation sends edited text exactly once and displays AI result');
  await main(); await submit('https://example.com/cancel'); await waitFor(`Boolean(document.getElementById('article-preview'))`);
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
  console.log('PASS manual AI failure preserves clearly labeled local fallback');
  await main(); await submit('https://example.com/ai-error'); await waitFor(`Boolean(document.getElementById('article-preview'))`);
  await evaluate(`document.getElementById('article-confirm').click()`);
  await waitFor(`document.getElementById('article-error').textContent.includes('Limit testowy')`);
  assert.equal(await evaluate(`document.getElementById('article-preview').value`), articleText);
  assert.equal(await evaluate(`document.getElementById('article-confirm').disabled`), false);
  console.log('PASS AI denial preserves editable preview for retry');
  await main(); await evaluate(`sbStore(null)`);
  const beforeGuest = calls.length;
  await submit('https://example.com/guest'); await waitFor(`document.getElementById('analyze-msg').textContent.includes('Zaloguj')`);
  assert.equal(calls.length, beforeGuest);
  await submit(edited); await waitFor(`location.hash === '#Article'`);
  assert.equal(calls.length, beforeGuest); assert.equal(await evaluate(`curArticle().ai`), false);
  console.log('PASS guests cannot fetch/use AI; manual local analysis works');
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log('9 browser scenarios passed; no real OpenAI or Supabase requests.');
} finally {
  socket?.close(); browser.kill('SIGTERM');
  await new Promise(resolve => { if (browser.exitCode !== null) resolve(); else browser.once('exit', resolve); });
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
