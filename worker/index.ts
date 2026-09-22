import { InputError } from '../shared/errors'
import { BRAND,NOTICE,SUGGESTED_PAIRS } from '../shared/config'
import { canonicalPair,untoken,vsPath,normalize } from '../shared/identity'
import { comparison } from '../shared/math'
import type { WorkerEnv,TrendData } from '../shared/types'
import { context,mockMode } from '../server/trendpick/context'
import { rankings,trend,content,periodOf,trendCacheKey } from '../server/trendpick/service'
interface Env extends WorkerEnv { ASSETS:Fetcher }
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}})
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
async function api(request:Request,env:Env){
 const url=new URL(request.url),q=url.searchParams,path=url.pathname
 if(path==='/api/events'&&request.method==='POST'){
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Forbidden'},403)
  const text=await request.text();if(text.length>2048)return json({error:'Too large'},413)
  const body=JSON.parse(text) as {event?:string;a?:string;b?:string}
  if(!['vs_search','vs_share','keyword_search','shopping_click','trending_click','category_change','period_change'].includes(body.event??''))return json({error:'Invalid event'},400)
  console.info('[analytics]',{event:body.event})
  if((body.event==='vs_search'||body.event==='vs_share')&&body.a&&body.b&&!mockMode(env)){
   const [a,b]=canonicalPair(body.a,body.b),ctx=context(env)
   const {data:known}=await ctx.db.from('search_content_cache').select('payload').eq('key',trendCacheKey([a,b],'7d')).maybeSingle()
   if(!known?.payload || comparison(known.payload as TrendData,a,b,'7d').shareA===null)return json({ok:true})
   // Idempotent bucket avoids repeated browser refreshes inflating the public list.
   const key=`event:${body.event}:${JSON.stringify([a,b])}:${Math.floor(Date.now()/3600000)}`
   const {cached}=await import('../server/trendpick/cache')
   await cached(ctx,key,3600,async()=>{const {error}=await ctx.db.rpc('tp_comparison_event',{p_a:a,p_b:b,p_share:body.event==='vs_share'});if(error)throw error;return {ok:true}})
  }
  return json({ok:true})
 }
 if(request.method!=='GET')return json({error:'Method not allowed'},405)
 if(path==='/api/config')return json({brand:BRAND,mode:mockMode(env)?'mock':'real',ads:env.ADS_ENABLED==='true'})
 if(path==='/api/trends'||path==='/api/shopping')return json(await rankings(env,periodOf(q.get('period'),true),q.get('category')??'전체',path==='/api/shopping'))
 if(path==='/api/vs'){
  const [a,b]=canonicalPair(q.get('a')??'',q.get('b')??''),period=periodOf(q.get('period'))
  const result=await trend(env,[a,b],period)
  const [ka,kb]=result.data.series.map(s=>s.keyword)
  return json({...result,data:comparison(result.data,ka,kb,period)})
 }
 if(path==='/api/keyword')return json(await trend(env,[q.get('q')??''],periodOf(q.get('period')),q.get('shopping')==='1',{device:q.get('device')??'',gender:q.get('gender')??'',age:q.get('age')??''}))
 if(path==='/api/content')return json(await content(env,q.get('q')??''))
 if(path==='/api/popular'){
  if(mockMode(env))return json({data:SUGGESTED_PAIRS.map(([a,b])=>({a,b})),suggested:true})
  const {data,error}=await context(env).db.from('popular_comparisons').select('keyword_a,keyword_b,view_count').order('view_count',{ascending:false}).limit(6)
  if(error)throw error
  return json({data:data?.length?data.map(p=>({a:p.keyword_a,b:p.keyword_b})):SUGGESTED_PAIRS.map(([a,b])=>({a,b})),suggested:!data?.length})
 }
 return json({error:'API 경로를 찾을 수 없습니다.'},404)
}
async function cachedApi(request:Request,env:Env){
 if(request.method!=='GET')return api(request,env)
 const url=new URL(request.url)
 if(!['/api/trends','/api/shopping','/api/vs','/api/keyword','/api/content','/api/popular'].includes(url.pathname))return api(request,env)
 const cacheUrl=new URL(url)
 if(url.pathname==='/api/vs'){
  const [a,b]=canonicalPair(url.searchParams.get('a')??'',url.searchParams.get('b')??'')
  cacheUrl.searchParams.set('a',a);cacheUrl.searchParams.set('b',b)
 }
 cacheUrl.searchParams.set('_mode',env.DATA_MODE??'mock');cacheUrl.searchParams.sort()
 const key=new Request(cacheUrl),cache=caches.default,hit=await cache.match(key)
 if(hit)return hit
 const response=await api(request,env)
 if(response.ok){
  const body=await response.clone().json() as {meta?:{stale?:boolean}}
  const ttl=body.meta?.stale?30:url.pathname==='/api/vs'||url.pathname==='/api/keyword'?3600:url.pathname==='/api/content'?1800:300
  const headers=new Headers(response.headers);headers.set('Cache-Control',`public, max-age=30, s-maxage=${ttl}`)
  const cached=new Response(response.body,{status:response.status,headers});await cache.put(key,cached.clone());return cached
 }
 return response
}
async function page(request:Request,env:Env){
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean)
 if(parts[0]==='issue')return new Response(null,{status:301,headers:{Location:'/trending'}})
 if(url.pathname==='/robots.txt')return new Response(`User-agent: *\nDisallow: /api/\nSitemap: ${env.SITE_URL||url.origin}/sitemap.xml`,{headers:{'Content-Type':'text/plain'}})
 if(url.pathname==='/sitemap.xml')return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/','/trending','/vs','/shopping','/about','/methodology'].map(p=>`<url><loc>${escape((env.SITE_URL||url.origin)+p)}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml'}})
 const staticNames:Record<string,string>={'/trending':'급상승 관심도','/vs':'A vs B 비교','/shopping':'쇼핑 클릭 관심도','/about':'서비스 소개','/methodology':'계산 방법','/privacy':'개인정보처리방침','/terms':'이용약관'}
 let title=staticNames[url.pathname]?`${staticNames[url.pathname]} | ${BRAND.name}`:`${BRAND.name} · ${BRAND.tagline}`,description=BRAND.description as string,indexable=['/','/trending','/vs','/shopping','/about','/methodology','/privacy','/terms'].includes(url.pathname),canonical=url.pathname
 if(parts[0]==='vs'&&parts.length===3){
  const [a,b]=canonicalPair(untoken(decodeURIComponent(parts[1])),untoken(decodeURIComponent(parts[2])))
  canonical=vsPath(a,b)
  if(url.pathname!==canonical)return Response.redirect(new URL(canonical+url.search,url.origin).toString(),301)
  title=`${a} vs ${b} - 최근 관심도 비교 | ${BRAND.name}`;description=`NAVER Data Lab 상대 관심도로 ${a}와 ${b}를 비교합니다. ${NOTICE}`
  if(!mockMode(env)){
   try{const ctx=context(env);const {data}=await ctx.db.from('search_content_cache').select('payload,expires_at').eq('key',trendCacheKey([a,b],'7d')).maybeSingle()
    if(data?.payload&&Date.parse(data.expires_at)>Date.now()){const c=comparison(data.payload as TrendData,a,b,'7d');indexable=c.shareA!==null&&c.metricsA.coverage>=0.8&&c.metricsB.coverage>=0.8}
   }catch{indexable=false}
  }
 }else if(['search','shopping'].includes(parts[0])&&parts.length===2){
  const keyword=untoken(decodeURIComponent(parts[1]));title=`${keyword} 관심도 분석 | ${BRAND.name}`;description=`${keyword}의 기간별 상대 관심도와 관련 콘텐츠를 확인하세요.`
 }
 const asset=await env.ASSETS.fetch(request)
 if(!asset.headers.get('Content-Type')?.includes('text/html'))return asset
 const origin=env.SITE_URL||url.origin
 let html=new HTMLRewriter().on('title',{element(e){e.setInnerContent(escape(title),{html:true})}})
 .on('meta[name="description"]',{element(e){e.setAttribute('content',description)}})
 .on('meta[property="og:title"]',{element(e){e.setAttribute('content',title)}})
 .on('meta[property="og:description"]',{element(e){e.setAttribute('content',description)}})
 .on('meta[property="og:url"]',{element(e){e.setAttribute('content',origin+canonical)}})
 .on('meta[property="og:image"]',{element(e){e.setAttribute('content',origin+'/og.png')}})
 .on('meta[name="robots"]',{element(e){e.setAttribute('content',indexable?'index,follow':'noindex,follow')}})
 .on('link[rel="canonical"]',{element(e){e.setAttribute('href',origin+canonical)}})
 if(env.ADS_ENABLED!=='true')html=html.on('script[data-adsense]',{element(e){e.remove()}})
 const result=html.transform(asset);const headers=new Headers(result.headers);headers.set('Cache-Control','no-cache');headers.set('X-Content-Type-Options','nosniff')
 return new Response(result.body,{status:asset.status,headers})
}
export default {async fetch(request:Request,env:Env){try{return (new URL(request.url).pathname==='/api'||new URL(request.url).pathname.startsWith('/api/'))?await cachedApi(request,env):await page(request,env)}catch(error){console.error('[worker]',{message:error instanceof Error?error.message:'database error'});return json({error:error instanceof Error?error.message:'데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'},error instanceof InputError?400:503)}}}
