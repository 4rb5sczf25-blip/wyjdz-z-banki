import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../auth-return.js', import.meta.url), 'utf8');
function page(hash, { rejected = false } = {}) {
  const saved = [], notices = [], requests = [], history = [];
  const ctx = vm.createContext({ profileName: value => typeof value === 'string' ? value.slice(0,40) : '', URLSearchParams, location: { hash, origin: 'https://preview.example.com', pathname: '/', search: '' }, history: { replaceState: (_a, _b, url) => history.push(url) },
    showToast: text => notices.push(text), sbStore: s => saved.push(s), syncNow: async () => {}, current: 'Main', render: () => {},
    sbReq: async (path, options) => { requests.push({ path, options }); if (rejected) throw new Error('expired'); return { id: 'verified-user', email: 'test@example.com', email_confirmed_at: '2026-01-01' }; }
  });
  vm.runInContext(source, ctx);
  return { run: () => vm.runInContext('finishAuthReturn()', ctx), saved, notices, requests, history, ctx };
}
test('magic link tokens are removed before routing and verified before saving session', async () => {
  const p = page('#access_token=test.access&refresh_token=test.refresh&expires_in=3600&user_id=forged');
  assert.deepEqual(p.history, ['/#Main']);
  assert.equal(p.saved.length, 0);
  await p.run();
  assert.equal(p.saved.length, 1); assert.equal(p.saved[0].uid, 'verified-user');
  assert.equal(p.requests[0].path, '/auth/v1/user'); assert.equal(p.requests[0].options.token, 'test.access');
  assert.equal(vm.runInContext('AUTH_RETURN.access', p.ctx), null);
});
test('expired, malformed and rejected email links never create a session', async () => {
  for (const [hash, rejected] of [['#error=access_denied&error_description=expired', false], ['#access_token=test&expires_in=3600', false], ['#access_token=test&refresh_token=test&expires_in=oops', false], ['#access_token=test&refresh_token=test&expires_in=3600', true]]) {
    const p = page(hash, { rejected }); await p.run(); assert.equal(p.saved.length, 0); assert.equal(p.notices.length, 1); assert.equal(p.history.length, 1);
  }
});
test('normal screen hashes are preserved and OTP redirects back to current deployment', async () => {
  const p = page('#Settings'); await p.run(); assert.equal(p.history.length, 0); assert.equal(p.requests.length, 0);
  assert.equal(vm.runInContext('sbOtpPath()', p.ctx), '/auth/v1/otp?redirect_to=https%3A%2F%2Fpreview.example.com%2F%23Main');
});
