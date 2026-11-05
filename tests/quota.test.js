import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL migration enforces atomic daily budgets, cooldown, permissions, and separate actions', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    const migration = await readFile(new URL('../supabase/migrations/202611050001_analysis_quota.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(migration); // Repeatable installation.
    const uid = '11111111-1111-4111-8111-111111111111';
    const consume = async (id = uid, kind = 'analyze') => (await db.query('select public.consume_analysis_quota($1::uuid, $2) as ok', [id, kind])).rows[0].ok;
    const age = () => db.exec("update public.analysis_quota set last_used = now() - interval '1 minute'");
    assert.equal(await consume(), true); assert.equal(await consume(), false);
    for (let i = 1; i < 5; i++) { await age(); assert.equal(await consume(), true); }
    await age(); assert.equal(await consume(), false);
    assert.equal(await consume(uid, 'article'), true);
    assert.equal(await consume(uid, 'article'), false);
    for (let i = 1; i < 20; i++) { await age(); assert.equal(await consume(uid, 'article'), true); }
    await age(); assert.equal(await consume(uid, 'article'), false);
    const counts = await db.query("select used from public.analysis_quota where kind='analyze' and subject='global'");
    assert.equal(counts.rows[0].used, 5);
    await db.exec("update public.analysis_quota set used=99 where kind='analyze' and subject='global'");
    const results = await Promise.all([
      consume('22222222-2222-4222-8222-222222222222'), consume('33333333-3333-4333-8333-333333333333')
    ]);
    assert.deepEqual(results, [true, false]);
    await db.exec("update public.analysis_quota set used=500 where kind='article' and subject='global'");
    assert.equal(await consume('22222222-2222-4222-8222-222222222222', 'article'), false);
    await assert.rejects(() => consume(uid, 'other'));
    // Old days do not count against today.
    await db.exec("update public.analysis_quota set day = day - 1");
    assert.equal(await consume(), true);
    await db.exec('set role authenticated');
    await assert.rejects(() => consume());
    await assert.rejects(() => db.query('select * from public.analysis_quota'));
    await db.exec('reset role; set role anon');
    await assert.rejects(() => consume());
    await db.exec('reset role; set role service_role');
    assert.equal(await consume('44444444-4444-4444-8444-444444444444'), true);
  } finally { await db.close(); }
});

test('guest migration gives anonymous users two daily analyses and members five, sharing existing counters', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key, is_anonymous boolean not null default false);');
    await db.exec(await readFile(new URL('../supabase/migrations/202611050001_analysis_quota.sql', import.meta.url), 'utf8'));
    const migration = await readFile(new URL('../supabase/migrations/202611050002_guest_quota.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(migration);
    const guest = '11111111-1111-4111-8111-111111111111';
    const member = '22222222-2222-4222-8222-222222222222';
    await db.query('insert into auth.users values ($1, true), ($2, false)', [guest, member]);
    const consume = async (id, kind = 'analyze') => (await db.query('select public.consume_analysis_quota_v2($1::uuid, $2) as ok', [id, kind])).rows[0].ok;
    const age = () => db.exec("update public.analysis_quota set last_used = now() - interval '1 minute'");
    assert.equal(await consume(guest), true); assert.equal(await consume(guest), false);
    await age(); assert.equal(await consume(guest), true);
    await age(); assert.equal(await consume(guest), false);
    assert.equal(await consume(guest, 'article'), true);
    for (let i = 0; i < 5; i++) { await age(); assert.equal(await consume(member), true); }
    await age(); assert.equal(await consume(member), false);
    assert.equal(await consume('33333333-3333-4333-8333-333333333333'), false);
    await db.exec("update public.analysis_quota set day = day - 1");
    assert.equal(await consume(guest), true);
    await db.exec('set role authenticated'); await assert.rejects(() => consume(guest));
    await db.exec('reset role; set role anon'); await assert.rejects(() => consume(guest));
  } finally { await db.close(); }
});
