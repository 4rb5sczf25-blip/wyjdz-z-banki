import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler } from '../api/quota.js';
const user = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: true };
const response = () => ({ setHeader() {}, status(n) { this.code=n; return this; }, json(body) { this.body=body; return this; } });
for (const [guest, used, remaining] of [[true,0,2],[true,1,1],[true,2,0],[false,1,4],[false,8,0]]) {
  test(`reads authoritative remaining quota: guest=${guest}, used=${used}`, async () => {
    const handler = makeHandler({ identity: async () => ({ user: {...user,is_anonymous:guest}, url:'https://example.supabase.co',key:'test' }), now: () => new Date('2026-11-05T10:00:00Z'), fetcher: async (url, options) => {
      const parsed=new URL(url); assert.equal(parsed.searchParams.get('subject'),'eq.'+user.id); assert.equal(parsed.searchParams.get('day'),'eq.2026-11-05'); assert.equal(options.method,undefined); return {ok:true,json:async()=>used?[{used}]:[]};
    }});
    const r=response();await handler({method:'GET'},r);assert.equal(r.code,200);assert.equal(r.body.remaining,remaining);assert.equal(r.body.limit,guest?2:5);
  });
}
test('quota reads reject writes and never fabricate a count on database failure', async () => {
  const handler=makeHandler({identity:async()=>({user,url:'https://example.supabase.co',key:'test'}),fetcher:async()=>({ok:false})});
  const r=response();await handler({method:'POST'},r);assert.equal(r.code,405);
  const error=response();await handler({method:'GET'},error);assert.equal(error.code,503);assert.equal(error.body.remaining,undefined);
});
