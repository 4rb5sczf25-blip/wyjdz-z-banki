import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../guest-session.js', import.meta.url), 'utf8');
test('guest session creation is deduplicated; authenticated member session is reused', async () => {
  let session = null, requests = 0;
  const context = vm.createContext({ sessionVersion: () => 0, requireSessionVersion: () => {},
    sbToken: async () => session?.at || null, sbSession: () => session, sbStore: s => { session = s; },
    sbFromAuth: d => ({ at: d.access_token, anonymous: d.user.is_anonymous }),
    sbReq: async (path, options) => { requests++; assert.equal(path, '/auth/v1/signup'); assert.equal(options.body.email, undefined); return { access_token: 'guest', refresh_token: 'rt', user: { id: 'guest-id', is_anonymous: true } }; }
  });
  vm.runInContext(source, context);
  await Promise.all([vm.runInContext('ensureGuestSession()', context), vm.runInContext('ensureGuestSession()', context)]);
  assert.equal(requests, 1); assert.equal(session.anonymous, true);
  session = { at: 'member', anonymous: false };
  assert.equal(await vm.runInContext('ensureGuestSession()', context), 'member'); assert.equal(requests, 1);
});
test('disabled guest signup is reported without saving an invalid session', async () => {
  let saved = false;
  const context = vm.createContext({ sessionVersion: () => 0, requireSessionVersion: () => {}, sbToken: async () => null, sbSession: () => null, sbReq: async () => { throw new Error('disabled'); }, sbStore: () => { saved = true; } });
  vm.runInContext(source, context);
  await assert.rejects(() => vm.runInContext('ensureGuestSession()', context), /Tryb gościa AI/);
  assert.equal(saved, false);
});
