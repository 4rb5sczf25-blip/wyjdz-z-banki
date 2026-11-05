import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('counter migration grants server-only read without opening user access',async()=>{
  const db=new PGlite();
  try {
    await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
    await db.exec(await readFile(new URL('../supabase/migrations/202611050001_analysis_quota.sql',import.meta.url),'utf8'));
    await db.exec('set role service_role');
    await assert.rejects(()=>db.query('select used from public.analysis_quota'));
    await db.exec('reset role');
    const migration=await readFile(new URL('../supabase/migrations/202611050003_quota_read_permission.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration);
    await db.exec("insert into public.analysis_quota(day,kind,subject,used) values(current_date,'analyze','test-user',1)");
    await db.exec('set role service_role');
    assert.equal((await db.query('select used from public.analysis_quota')).rows[0].used,1);
    await assert.rejects(()=>db.exec('delete from public.analysis_quota'));
    for(const role of ['anon','authenticated']) {
      await db.exec('reset role;set role '+role);
      await assert.rejects(()=>db.query('select used from public.analysis_quota'));
    }
  }finally{await db.close();}
});
