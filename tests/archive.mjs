import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const db=new PGlite()
try{
 await db.exec('create role anon;create role authenticated;create role service_role;')
 await db.exec(await readFile('supabase/migrations/20260921_trendpick.sql','utf8'))
 // Legacy fixture matches the inspected historical schema columns used by migration.
 await db.exec(`create table keywords(id bigint primary key,keyword text,slug text,category text,first_detected_at timestamptz,last_detected_at timestamptz,related_keywords text[]);
 create table keyword_snapshots(id bigint primary key,keyword_id bigint,collected_at timestamptz,issue_score numeric,rank integer);
 create table news_articles(id bigint primary key,keyword_id bigint,title text,url text,publisher text,published_at timestamptz,collected_at timestamptz);
 insert into keywords values(1,'옛 이슈','old-issue','IT',now()-interval '100 days',now()-interval '90 days','{}');
 insert into keyword_snapshots values(1,1,now()-interval '90 days',88,2);
 insert into news_articles values(1,1,'옛 뉴스','https://example.com/old','example',now()-interval '90 days',now()-interval '90 days');`)
 const migration=await readFile('supabase/migrations/20260923_issue_archive.sql','utf8');await db.exec(migration);await db.exec(migration)
 let row=(await db.query("select * from issue_archive where slug='old-issue'")).rows[0];assert.equal(row.representative_news.length,1)
 const now=new Date().toISOString(),item={title:'K팝',slug:'k',summary:'수집된 상대 관심도의 상승이 확인되었습니다. 실제 검색 횟수나 특정 사건의 원인을 의미하지 않습니다.',firstSeenAt:now,lastSeenAt:now,score:60,rank:10,related:['케이팝'],news:Array.from({length:8},(_,i)=>({title:'기사 '+i,url:'https://example.com/'+i,source:'example',description:'MUST NOT SAVE'}))}
 const put=async items=>db.query('select tp_archive_put($1)',[JSON.stringify(items)])
 await put([item,{...item,title:'K리그'},{...item,title:'아이폰18',slug:'issue-18'}])
 row=(await db.query("select * from issue_archive where title='K팝'")).rows[0];const first=row.first_seen_at,created=row.created_at
 assert.equal(row.representative_news.length,5);assert(!JSON.stringify(row).includes('MUST NOT SAVE'))
 await put([{...item,slug:'other',firstSeenAt:new Date(Date.now()+1000).toISOString(),lastSeenAt:new Date(Date.now()+1000).toISOString(),score:80,rank:3,news:[]}])
 row=(await db.query("select * from issue_archive where title='K팝'")).rows[0];assert.equal(row.slug,'k');assert.deepEqual(row.first_seen_at,first);assert.deepEqual(row.created_at,created);assert.equal(row.peak_rank,3);assert.equal(row.peak_score,'80');assert.equal(row.representative_news.length,5)
 const other=(await db.query("select slug from issue_archive where title='K리그'")).rows[0].slug;assert(other.startsWith('k-'));await put([{...item,title:'K리그'}]);assert.equal((await db.query("select slug from issue_archive where title='K리그'")).rows[0].slug,other)
 await db.exec(await readFile('supabase/seeds/keywords.sql','utf8'))
 await db.exec(`insert into trend_rankings values(1,'search','7d','{"status":"ok","change":20,"changeRate":50,"asOf":"2026-09-22"}',70,now());`)
 assert.equal((await db.query('select tp_archive_refresh() n')).rows[0].n,1)
 assert.equal((await db.query('select jsonb_array_length(tp_archive_active()) n')).rows[0].n,1)
 await db.exec('delete from trend_rankings');assert.equal((await db.query('select jsonb_array_length(tp_archive_active()) n')).rows[0].n,0)
 await db.exec('select tp_archive_cleanup()');assert.equal((await db.query('select count(*)::int n from news_articles')).rows[0].n,0)
 assert.equal((await db.query("select representative_news from issue_archive where slug='old-issue'")).rows[0].representative_news.length,1)
 assert.equal((await db.query("select count(*)::int n from issue_archive where slug='missing'")).rows[0].n,0)
 await put([{...item,title:'옛 이슈',slug:'new-would-break',score:20,rank:15,news:[]}]);const migrated=(await db.query("select * from issue_archive where slug='old-issue'")).rows[0];assert.equal(migrated.peak_score,'20');assert.equal(migrated.legacy_peak.score,88);assert.equal(migrated.score_model,'trend7d');
 await db.exec('set role anon');await assert.rejects(()=>db.exec('select * from issue_archive'));await assert.rejects(()=>db.exec('select tp_archive_cleanup()'));await db.exec('reset role')
 console.log('PASS archive SQL: legacy migration, stable URLs, collision suffix, repeat upsert, preserved news after cleanup, TOP exit, RLS')
}finally{await db.close()}
