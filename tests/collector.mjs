import assert from 'node:assert/strict'
import { readFile,mkdtemp,rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { PGlite } from '@electric-sql/pglite'
const db=new PGlite(),temp=await mkdtemp(join(tmpdir(),'tp-collector-')),original=globalThis.fetch
try{
 await db.exec('create role anon;create role authenticated;create role service_role;')
 await db.exec(await readFile('supabase/migrations/20260921_trendpick.sql','utf8'))
 await db.exec(await readFile('supabase/seeds/keywords.sql','utf8'))
 await db.exec(await readFile('supabase/migrations/20260923_issue_archive.sql','utf8'))
 const outfile=join(temp,'collector.mjs');await build({entryPoints:['server/trendpick/collector.ts'],bundle:true,format:'esm',platform:'node',outfile,logLevel:'silent'})
 const {collect}=await import(pathToFileURL(outfile).href)
 const counts={naver:0,db:0};const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}})
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input))
  if(url.hostname==='db.example'){
   counts.db++;assert(url.pathname.includes('/rpc/'))
   const name=url.pathname.split('/').at(-1);assert(/^tp_[a-z_]+$/.test(name))
   const args=JSON.parse(String(init.body)),values=Object.values(args).map(v=>typeof v==='object'?JSON.stringify(v):v),params=Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',')
   if(name==='tp_candidates')return response((await db.query(`select * from ${name}(${params})`,values)).rows)
   return response((await db.query(`select ${name}(${params}) result`,values)).rows[0].result)
  }
  assert.equal(url.hostname,'naverapihub.apigw.ntruss.com');counts.naver++
  assert.equal(init.headers['X-NCP-APIGW-API-KEY-ID'],'fixture')
  assert.equal(init.headers['X-Naver-Client-Id'],undefined)
  const b=JSON.parse(String(init.body)),groups=b.keywordGroups??b.keyword
  assert(groups.length<=5)
  const days=Math.round((Date.parse(b.endDate)-Date.parse(b.startDate))/86400000)+1
  return response({results:groups.map(g=>({title:g.groupName??g.name,data:Array.from({length:days},(_,i)=>({period:new Date(Date.parse(b.startDate)+i*86400000).toISOString().slice(0,10),ratio:i<days-7?10:40}))}))})
 }
 const env={DATA_MODE:'real',NAVER_CLIENT_ID:'fixture',NAVER_CLIENT_SECRET:'fixture',SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'fixture'}
 const tick=Math.floor(Date.now()/10800000)*36
 const first=await collect(env,(tick+2)*300000),before=counts.naver
 const duplicate=await collect(env,(tick+2)*300000)
 assert.equal(counts.naver,before,'duplicate schedule must not call NAVER')
 assert(first.data.saved>=27);assert.equal(duplicate.data.saved,first.data.saved)
 const shopping=await collect(env,(tick+3)*300000)
 assert(shopping.data.saved>0)
 const total=(await db.query('select count(*)::int n from trend_snapshots')).rows[0].n
 assert.equal(total,first.data.saved+shopping.data.saved)
 console.log('PASS Collector integration (fixture NAVER, real SQL):',JSON.stringify({searchSaved:first.data.saved,shoppingSaved:shopping.data.saved,counts}))
}finally{globalThis.fetch=original;await db.close();await rm(temp,{recursive:true,force:true})}
