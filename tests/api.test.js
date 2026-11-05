import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler as analyzeHandler, validateAnalysis } from '../api/analyze.js';
import { makeHandler as articleHandler } from '../api/article.js';
import { authorize } from '../server/access.js';
import { HttpError } from '../server/policy.js';

const text = 'Sejm przyjął ustawę o transporcie regionalnym.';
function req(body = { text }, extra = {}) { return { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test.jwt.token' }, body, ...extra }; }
function res() { return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } }; }
function modelResponse(sentences = [{ type: 'fact', text }]) { return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ sentences }) } }] }; }
function setup(response = modelResponse()) {
  let calls = 0, options;
  const handler = analyzeHandler({ configured: () => true, access: async () => {}, clientFactory: () => ({ chat: { completions: { create: async o => { calls++; options = o; return response; } } } }) });
  return { handler, count: () => calls, options: () => options };
}
test('validates methods, body, text lengths before any AI call', async () => {
  const { handler, count } = setup();
  for (const [request, code] of [[req({}, { method: 'GET' }), 405], [req({}, { headers: {} }), 415], [req('{oops'), 400], [req({ text: 'short' }), 400], [req({ text: 'x'.repeat(12001) }), 400], [req({ text, extra: 'x'.repeat(50000) }), 400], [req([]), 400], [req({ text: 5 }), 400]]) {
    const r = res(); await handler(request, r); assert.equal(r.code, code); assert.equal(r.headers['Cache-Control'], 'no-store');
  }
  assert.equal(count(), 0);
});
test('AI has hard model/token budget, system instruction and structured response; no real API calls', async () => {
  const s = setup(); const r = res(); await s.handler(req(), r);
  assert.equal(r.code, 200); assert.deepEqual(r.body.s, [['fact', text]]); assert.equal(r.body.raw, text); assert.equal(r.body.ai, true);
  const o = s.options(); assert.equal(o.model, 'gpt-4o-mini'); assert.equal(o.max_tokens, 1600); assert.equal(o.n, 1); assert.equal(o.response_format.json_schema.strict, true); assert.equal(o.messages[0].role, 'system');
});
test('rejects malformed, overlong, refused or truncated model output', async () => {
  for (const rows of [[], Array(13).fill({ type: 'fact', text }), [{ type: 'other', text }], [{ type: 'fact', text: 'x'.repeat(301) }], [{ type: 'fact', text: '' }]]) {
    assert.throws(() => validateAnalysis({ sentences: rows }), { status: 502 });
    const s = setup(modelResponse(rows)); const r = res(); await s.handler(req(), r); assert.equal(r.code, 502);
  }
  for (const response of [{ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }, { choices: [{ finish_reason: 'stop', message: { refusal: 'no' } }] }, { choices: [{ finish_reason: 'stop', message: { content: 'not JSON' } }] }]) {
    const r = res(); await setup(response).handler(req(), r); assert.equal(r.code, 502);
  }
});
test('denied quota/config prevents model construction', async () => {
  for (const code of [401, 429, 503]) {
    let called = false;
    const handler = analyzeHandler({ configured: () => true, access: async () => { throw new HttpError(code, 'denied'); }, clientFactory: () => { called = true; } });
    const r = res(); await handler(req(), r); assert.equal(r.code, code); assert.equal(called, false);
  }
});
test('article endpoint authenticates, extracts and never calls AI', async () => {
  let kind; let calls = 0;
  const handler = articleHandler({ access: async (_req, k) => { kind = k; }, extract: async url => { calls++; return { url, text }; } });
  const r = res(); await handler(req({ url: 'https://example.com/article' }), r);
  assert.equal(kind, 'article'); assert.equal(r.code, 200); assert.equal(calls, 1);
  const bad = res(); await handler(req({ url: 'file:///etc/passwd' }), bad); assert.equal(bad.code, 400); assert.equal(calls, 1);
});
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key' };
const user = { id: '11111111-1111-4111-8111-111111111111', email_confirmed_at: '2026-01-01', is_anonymous: false };
test('auth verifies Supabase user and durable quota with service role only', async () => {
  const seen = [];
  await authorize(req(), 'analyze', { env, fetcher: async (url, options) => {
    seen.push({ url, options }); return { ok: true, status: 200, json: async () => url.endsWith('/user') ? user : true };
  } });
  assert.equal(seen.length, 2); assert.equal(seen[0].options.headers.Authorization, 'Bearer test.jwt.token');
  assert.equal(seen[1].options.headers.Authorization, 'Bearer test-only-key');
  assert.deepEqual(JSON.parse(seen[1].options.body), { p_user: user.id, p_kind: 'analyze' });
});
test('auth/quotas fail closed on missing config, invalid user, denial, outage or unexpected result', async () => {
  await assert.rejects(() => authorize(req({}, { headers: {} }), 'analyze', { env }), { status: 401 });
  await assert.rejects(() => authorize(req(), 'analyze', { env: {} }), { status: 503 });
  for (const [quota, code] of [[false, 429], [null, 503], [[], 503]]) {
    await assert.rejects(() => authorize(req(), 'analyze', { env, fetcher: async url => ({ ok: true, json: async () => url.endsWith('/user') ? user : quota }) }), { status: code });
  }
  for (const badUser of [{ ...user, email_confirmed_at: null }, { id: 'fake' }]) {
    await assert.rejects(() => authorize(req(), 'article', { env, fetcher: async () => ({ ok: true, json: async () => badUser }) }), { status: 401 });
  }
  await assert.rejects(() => authorize(req(), 'article', { env, fetcher: async () => { throw new Error('network'); } }), { status: 503 });
});

test('verified anonymous sessions can consume guest quota; client-supplied identity is ignored', async () => {
  const seen = [];
  await authorize(req({ text, user_id: 'forged', anonymous: false }), 'analyze', { env, fetcher: async (url, options) => {
    seen.push({ url, options });
    return { ok: true, json: async () => url.endsWith('/user') ? { ...user, email_confirmed_at: null, is_anonymous: true } : true };
  } });
  assert.match(seen[1].url, /consume_analysis_quota_v2$/);
  assert.equal(JSON.parse(seen[1].options.body).p_user, user.id);
});
