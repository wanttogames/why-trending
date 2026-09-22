import assert from 'node:assert/strict'
import { archiveResponse } from '../worker/archive'
const original=globalThis.fetch
const row={id:1,slug:'k-test',title:'테스트 키워드',summary:'최근 7일 상대 관심도가 이전 기간보다 50% 증가했습니다. 검색 횟수나 원인을 의미하지 않습니다.',first_seen_at:'2026-09-01T00:00:00Z',last_seen_at:'2026-09-02T00:00:00Z',peak_score:80,peak_rank:2,category:'IT',related_keywords:['별칭'],representative_news:[{title:'<script>alert(1)</script>',url:'https://example.com/news',publisher:'example',publishedAt:'2026-09-02'}],updated_at:'2026-09-02T00:00:00Z'}
const env={DATA_MODE:'real',SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'fixture',SITE_URL:'https://trend.example'}
try{
 globalThis.fetch=async(input,init)=>{const u=new URL(String(input));if(u.pathname.endsWith('/tp_archive_active'))return Response.json([]);if(init?.method==='HEAD')return new Response(null,{headers:{'Content-Range':'0-0/1'}});if(u.searchParams.has('slug'))return Response.json(u.searchParams.get('slug')==='eq.k-test'?row:u.searchParams.get('slug')==='eq.second'?{...row,slug:'second',title:'두 번째 이슈',summary:'두 번째 키워드의 상승 기록입니다. 다른 기간의 관측값을 설명합니다.'}:null);if(u.searchParams.has('category'))return Response.json([]);return Response.json([row])}
 const get=(p:string)=>archiveResponse(new Request('https://trend.example'+p),env)
 const detail=await get('/issue/k-test'),html=await detail.text();assert.equal(detail.status,200);assert(html.includes('과거 이슈'));assert(html.includes(row.summary));assert(html.includes('https://trend.example/issue/k-test'));assert(html.includes('property="og:image"'));assert(!html.includes('<script>alert'));assert(html.includes('&lt;script&gt;'))
 const second=await (await get('/issue/second')).text();assert(second.includes('두 번째 이슈 관련 이슈와 뉴스'));assert(!second.includes(row.summary));
 const missing=await get('/issue/missing');assert.equal(missing.status,404);assert((await missing.text()).includes('noindex,follow'))
 assert.equal((await get('/api/issues/missing')).status,404)
 const api=await (await get('/api/issues/k-test')).json() as {data:{status:string}};assert.equal(api.data.status,'ARCHIVED')
 assert((await (await get('/sitemap.xml')).text()).includes('sitemap-issues-1.xml'))
 assert((await (await get('/sitemap-issues-1.xml')).text()).includes('/issue/k-test'))
 assert((await (await get('/robots.txt')).text()).includes('Allow: /'))
 assert((await (await get('/issues')).text()).includes('/issue/k-test'))
 console.log('PASS archive Worker: server body/meta, archived sitemap, 404, API, XML, XSS escaping')
}finally{globalThis.fetch=original}
