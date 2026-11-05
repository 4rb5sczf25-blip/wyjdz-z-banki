import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { articleURL, destination, publicIPv4, fetchArticle, extractArticle, requestHTML, MAX_HTML } from '../server/article.js';

const paragraph = 'Sejm przyjął nową ustawę dotyczącą transportu regionalnego. Mieszkańcy będą mogli korzystać z nowych połączeń od przyszłego roku. ';
const html = `<html><head><meta charset="utf-8"><title>Transport w regionie</title></head><body><nav>Menu i reklamy</nav><article><h1>Transport w regionie</h1>${Array.from({ length: 5 }, () => `<p>${paragraph}</p>`).join('')}</article><script>globalThis.compromised=true</script></body></html>`;
test('rejects local, special, obfuscated and credential-bearing URLs', () => {
  for (const raw of ['file:///etc/passwd', 'ftp://example.com/a', 'https://a:b@example.com/', 'http://localhost', 'http://[::1]/', 'http://[2606:4700::1111]/', 'https://example.com:444/', 'https://example.com\\@127.0.0.1/', 'https://example.com/\n']) {
    assert.throws(() => articleURL(raw), { status: 400 }, raw);
  }
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '192.0.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255', '::ffff:8.8.8.8']) assert.equal(publicIPv4(ip), false, ip);
  assert.equal(publicIPv4('8.8.8.8'), true);
});
test('rejects DNS private/mixed answers and canonicalized numeric loopback', async () => {
  for (const raw of ['http://2130706433', 'http://0177.0.0.1', 'http://0x7f000001', 'http://127.1']) {
    await assert.rejects(() => destination(articleURL(raw)), { status: 400 });
  }
  await assert.rejects(() => destination(articleURL('https://example.com'), async () => ['8.8.8.8', '10.0.0.1']), { status: 400 });
  assert.equal(await destination(articleURL('https://example.com'), async () => ['8.8.8.8']), '8.8.8.8');
});
test('extracts plain article text without navigation or executing scripts', () => {
  const d = extractArticle(Buffer.from(html), new URL('https://example.com/story'));
  assert.match(d.text, /Sejm przyjął/);
  assert.doesNotMatch(d.text, /Menu i reklamy|compromised/);
  assert.equal(globalThis.compromised, undefined);
  assert.equal(d.title, 'Transport w regionie');
  assert.equal(d.truncated, false);
});
test('caps extracted text, rejects unreadable pages', () => {
  const d = extractArticle(Buffer.from(`<html><body><article>${('<p>' + paragraph.repeat(6) + '</p>').repeat(25)}</article></body></html>`), new URL('https://example.com'));
  assert.equal(d.text.length, 12000); assert.equal(d.truncated, true);
  assert.throws(() => extractArticle(Buffer.from('<html><body>Log in</body></html>'), new URL('https://example.com')), { status: 422 });
});
test('revalidates every redirect before sending any private request', async () => {
  const called = [];
  await assert.rejects(() => fetchArticle('https://example.com', {
    resolve: async () => ['8.8.8.8'], request: async (url, ip) => { called.push([url.href, ip]); return { status: 302, location: 'http://169.254.169.254/latest' }; }
  }), { status: 400 });
  assert.equal(called.length, 1);
  await assert.rejects(() => fetchArticle('https://example.com', {
    resolve: async host => host === 'example.com' ? ['8.8.8.8'] : ['127.0.0.1'],
    request: async () => ({ status: 302, location: 'https://private.example.org/' })
  }), { status: 400 });
});
test('limits redirects, timeouts, and pins public IP instead of resolving again', async () => {
  let calls = 0;
  await assert.rejects(() => fetchArticle('https://example.com', { resolve: async () => ['8.8.8.8'], request: async () => { calls++; return { status: 301, location: '/loop' }; } }), { status: 422 });
  assert.equal(calls, 4);
  // Keep event loop alive: AbortSignal.timeout intentionally uses an unref timer.
  const hold = setInterval(() => {}, 100);
  try { await assert.rejects(() => fetchArticle('https://example.com', { resolve: () => new Promise(() => {}), timeout: 10 }), { status: 422 }); }
  finally { clearInterval(hold); }
  const d = await fetchArticle('https://example.com', {
    resolve: async () => ['8.8.8.8'], request: async (url, ip, signal) => {
      assert.equal(ip, '8.8.8.8'); assert.equal(signal.aborted, false);
      return { status: 200, html: Buffer.from(html), contentType: 'text/html; charset=utf-8' };
    }
  });
  assert.match(d.text, /Mieszkańcy/);
});
// Exercise the streaming transport with a fake socket layer, never the Internet.
test('transport rejects MIME types, compressed payloads, oversized headers/bodies and pins DNS', async () => {
  const original = http.request;
  let headers = { 'content-type': 'text/html' }; let body = Buffer.from(html); let optionsSeen;
  http.request = (_url, options, callback) => {
    optionsSeen = options;
    const req = new EventEmitter();
    req.end = () => {
      const res = new EventEmitter(); res.statusCode = 200; res.headers = headers; res.destroy = () => {};
      queueMicrotask(() => { callback(res); res.emit('data', body); res.emit('end'); });
    };
    return req;
  };
  try {
    await requestHTML(new URL('http://example.com'), '8.8.8.8', new AbortController().signal);
    optionsSeen.lookup('example.com', {}, (err, ip, family) => { assert.equal(err, null); assert.equal(ip, '8.8.8.8'); assert.equal(family, 4); });
    assert.equal(optionsSeen.agent, false); assert.equal(optionsSeen.maxHeaderSize, 16384);
    for (const value of ['application/pdf', 'application/json']) {
      headers = { 'content-type': value }; await assert.rejects(() => requestHTML(new URL('http://example.com'), '8.8.8.8'), { status: 422 });
    }
    headers = { 'content-type': 'text/html', 'content-encoding': 'gzip' };
    await assert.rejects(() => requestHTML(new URL('http://example.com'), '8.8.8.8'), { status: 422 });
    headers = { 'content-type': 'text/html', 'content-length': String(MAX_HTML + 1) };
    await assert.rejects(() => requestHTML(new URL('http://example.com'), '8.8.8.8'), { status: 422 });
    headers = { 'content-type': 'text/html' }; body = Buffer.alloc(MAX_HTML + 1);
    await assert.rejects(() => requestHTML(new URL('http://example.com'), '8.8.8.8'), { status: 422 });
  } finally { http.request = original; }
});

test('unsupported publisher CSS does not prevent extraction or flood logs with page content', () => {
  const original = console.warn; const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    const content = html.replace('</head>', '<style>body { color: red; /* unclosed publisher comment</style></head>');
    const article = extractArticle(Buffer.from(content), new URL('https://example.com'));
    assert.match(article.text, /Sejm przyjął/);
    assert.equal(warnings.length, 0);
  } finally { console.warn = original; }
});
