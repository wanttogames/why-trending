import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const db=new PGlite()
try {
 await db.exec('create role anon; create role authenticated; create role service_role;')
 await db.exec(await readFile('supabase/migrations/20260921_trendpick.sql','utf8'))
 await db.exec(await readFile('supabase/seeds/keywords.sql','utf8'))
 await db.exec(await readFile('supabase/seeds/keywords.sql','utf8'))
 assert.equal((await db.query('select count(*)::int n from trend_keywords')).rows[0].n,500)
 assert.equal((await db.query('select count(*)::int n from trend_keywords where shopping_category is not null')).rows[0].n,190)
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002'
 const rpc=async(sql,params=[])=> (await db.query(sql,params)).rows[0].result
 assert.equal((await rpc('select tp_claim_cache($1,$2) result',['test',a])).state,'claimed')
 assert.equal((await rpc('select tp_claim_cache($1,$2) result',['test',b])).state,'busy')
 await assert.rejects(()=>rpc('select tp_finish_cache($1,$2,$3,$4) result',['test',b,'{}',3600]))
 await rpc('select tp_finish_cache($1,$2,$3,$4) result',['test',a,'{"value":62}',3600])
 assert.equal((await rpc('select tp_claim_cache($1,$2) result',['test',b])).state,'hit')
 assert.equal(await rpc("select tp_permit('trend') result"),true)
 await db.exec("update api_usage set calls=35000 where service='trend'")
 assert.equal(await rpc("select tp_permit('trend') result"),false)
 assert.equal(await rpc("select tp_permit('shopping') result"),true)
 const snap=[{keyword_id:1,source:'search',series:{series:[]},recorded_at:new Date().toISOString()}]
 const rank=[{keyword_id:1,source:'search',period:'7d',metrics:{changeRate:62},trend_score:55,recorded_at:snap[0].recorded_at}]
 assert.equal(await rpc('select tp_save($1,$2) result',[JSON.stringify(snap),JSON.stringify(rank)]),1)
 const invalid=[{...rank[0],keyword_id:999999}]
 await assert.rejects(()=>rpc('select tp_save($1,$2) result',[JSON.stringify([{...snap[0],keyword_id:2}]),JSON.stringify(invalid)]))
 assert.equal((await db.query('select count(*)::int n from trend_snapshots')).rows[0].n,1,'atomic rollback')
 for(let slot=0;slot<18;slot++){const rows=(await db.query("select * from tp_candidates($1,18,'search')",[slot])).rows;assert(rows.length>=27&&rows.length<=28)}
 await db.exec('set role anon')
 await assert.rejects(()=>db.query('select * from search_content_cache'))
 await assert.rejects(()=>db.query("select tp_permit('trend')"))
 await db.exec('reset role')
 console.log('PASS PostgreSQL: migration, idempotent 500 seed, leases, budgets, bulk atomicity, shards, access controls')
}finally{await db.close()}
