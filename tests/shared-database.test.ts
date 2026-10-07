import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',D='44444444-4444-4444-8444-444444444444';
async function setup(){const db=new PGlite();await db.exec(`create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create role anon;create role authenticated;grant usage on schema public,auth to authenticated,anon;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${A}','a@example.com',now()),('${B}','b@example.com',now()),('${C}','c@example.com',now()),('${D}','d@example.com',null);`);return db;}
async function as(db:PGlite,id:string){await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`);}
async function admin(db:PGlite){await db.exec("reset role;set request.jwt.claim.sub=''");}
async function scalar<T>(db:PGlite,sql:string,args:unknown[]=[]){return (await db.query<{value:T}>(sql,args)).rows[0].value;}
test('houses, co-owners, invitations, archive and cross-house isolation',async()=>{
 const db=await setup();try{
  await db.exec(await fs.readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  await as(db,A);const h1=await scalar<string>(db,"select public.create_house('First house','TZS') as value");const h2=await scalar<string>(db,"select public.create_house('Second house','USD') as value");
  assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.stages where house_id=$1',[h1]),20);
  assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.items where house_id=$1',[h1]),42);
  assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.payments'),0);
  assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.stages where budget is not null'),0);
  const s1=await scalar<string>(db,'select id as value from public.stages where house_id=$1 limit 1',[h1]);const s2=await scalar<string>(db,'select id as value from public.stages where house_id=$1 limit 1',[h2]);
  await assert.rejects(db.query("insert into public.payments(house_id,stage_id,amount,description)values($1,$2,12,'wrong house')",[h1,s2]));
  await assert.rejects(db.query("insert into public.payments(house_id,stage_id,created_by,amount,description)values($1,$2,$3,12,'spoofed author')",[h1,s1,B]));
  const token=await scalar<string>(db,"select public.create_house_invitation($1,'B@EXAMPLE.COM') as value",[h1]);assert.match(token,/^[a-f0-9]{64}$/);
  await assert.rejects(db.exec('select token_hash from public.house_invitations'));
  await as(db,C);assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.houses'),0);await assert.rejects(db.query('select public.accept_house_invitation($1)',[token]));
  await as(db,B);await db.query('select public.accept_house_invitation($1)',[token]);await assert.rejects(db.query('select public.accept_house_invitation($1)',[token]));
  assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.houses'),1);
  await db.query("insert into public.payments(house_id,stage_id,amount,description)values($1,$2,250,'shared payment')",[h1,s1]);
  await db.query('update public.stages set budget=1000 where id=$1',[s1]);
  await as(db,A);assert.equal(await scalar<string>(db,'select sum(amount)::text as value from public.payments where house_id=$1',[h1]),'250');
  await db.query('select public.set_house_archived($1,true)',[h1]);
  assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.payments where house_id=$1',[h1]),1);
  await assert.rejects(db.query("insert into public.tasks(house_id,stage_id,title)values($1,$2,'archived')",[h1,s1]));
  assert.equal((await db.query('update public.stages set budget=10 where id=$1 returning id',[s1])).rows.length,0);
  await assert.rejects(db.query("select public.create_house_invitation($1,'c@example.com')",[h1]));
  await db.query('select public.set_house_archived($1,false)',[h1]);
  let link=await scalar<string>(db,"select public.create_house_invitation($1,'c@example.com') as value",[h1]);
  let invitation=await scalar<string>(db,"select id as value from public.house_invitations where email='c@example.com' and revoked_at is null",[]);
  await db.query('select public.revoke_house_invitation($1)',[invitation]);await as(db,C);await assert.rejects(db.query('select public.accept_house_invitation($1)',[link]));
  await as(db,A);link=await scalar<string>(db,"select public.create_house_invitation($1,'c@example.com') as value",[h1]);await admin(db);await db.exec("update public.house_invitations set expires_at=now()-interval '1 second' where email='c@example.com'");await as(db,C);await assert.rejects(db.query('select public.accept_house_invitation($1)',[link]));
  await as(db,A);await db.query('select public.remove_house_member($1,$2)',[h1,B]);
  await as(db,B);assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.payments'),0);
  await as(db,A);assert.equal(await scalar<string>(db,'select sum(amount)::text as value from public.payments where house_id=$1',[h1]),'250');
  await assert.rejects(db.query('select public.remove_house_member($1,$2)',[h1,A]));
  await as(db,D);await assert.rejects(db.exec("select public.create_house('Unverified','')"));
  await db.exec('reset role;set role anon');await assert.rejects(db.exec('select * from public.houses'));await assert.rejects(db.exec("select public.create_house('Anonymous','')"));
 }finally{await db.close();}
});
test('last-owner removals are serialized and always retain an owner',async()=>{
 const db=await setup();try{await db.exec(await fs.readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));await as(db,A);const hid=await scalar<string>(db,"select public.create_house('Shared','') as value");const token=await scalar<string>(db,"select public.create_house_invitation($1,'b@example.com') as value",[hid]);await as(db,B);await db.query('select public.accept_house_invitation($1)',[token]);
 // PGlite serializes sessions; schedule both contenders and verify the locked RPC invariant.
 const results=await Promise.allSettled([db.exec(`set request.jwt.claim.sub='${A}';select public.remove_house_member('${hid}','${B}')`),db.exec(`set request.jwt.claim.sub='${B}';select public.remove_house_member('${hid}','${A}')`)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);await as(db,A);assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.house_members where house_id=$1',[hid]),1);
 assert.equal(await scalar<boolean>(db,"select position('for update' in lower(pg_get_functiondef('public.remove_house_member(uuid,uuid)'::regprocedure)))>0 or position('lock_editable_house' in pg_get_functiondef('public.remove_house_member(uuid,uuid)'::regprocedure))>0 as value"),true);
 }finally{await db.close();}
});
test('legacy migration preserves identifiers, edits and original financial totals',async()=>{
 const db=await setup();try{await db.exec(await fs.readFile(new URL('./fixtures/legacy-schema.sql',import.meta.url),'utf8'));await db.exec(`insert into public.house_access values('${A}'),('${B}')`);await as(db,A);await db.exec('select public.initialize_house()');const ids=(await db.query<{id:string}>('select id from public.payments order by id')).rows.map(r=>r.id);
 await as(db,B);await db.exec('select public.initialize_house()');await db.exec("update public.projects set notes='Retain this edit' where name='Fence'");await admin(db);await db.exec(await fs.readFile(new URL('../supabase/migrate-v2.sql',import.meta.url),'utf8'));
 await as(db,A);assert.deepEqual((await db.query<{id:string}>('select id from public.payments order by id')).rows.map(r=>r.id),ids);assert.equal(await scalar<string>(db,'select sum(amount)::text as value from public.payments'),'59100000');
 assert.equal(await scalar<string>(db,"select (s.budget-sum(p.amount))::text as value from public.stages s join public.payments p on p.stage_id=s.id where s.name='Fence' group by s.id"),'6000000');
 await as(db,B);assert.equal(await scalar<string>(db,"select notes as value from public.stages where name='Fence'"),'Retain this edit');assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.houses'),1);
 }finally{await db.close();}
});
test('private workbook import is administrator-only and idempotent',async()=>{
 const db=await setup();try{await db.exec(await fs.readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));const sql=(await fs.readFile(new URL('../supabase/import-mabena.sql',import.meta.url),'utf8')).replaceAll('OWNER_EMAIL','a@example.com');await db.exec(sql);await db.exec(sql);await as(db,A);assert.equal(await scalar<string>(db,'select sum(amount)::text as value from public.payments'),'59100000');assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.houses'),1);await as(db,B);assert.equal(await scalar<number>(db,'select count(*)::integer as value from public.houses'),0);}finally{await db.close();}
});
