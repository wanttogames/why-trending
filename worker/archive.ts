import type { WorkerEnv } from '../shared/types'
import { BRAND } from '../shared/config'
import { issueList,issueDetail,archivePageNumber,sitemapRows,sitemapCount } from '../server/trendpick/archive'
import { esc,issuePath,issueTitle,issueDescription,issueBody,listBody,archiveDocument } from '../shared/archive'
import { mockMode } from '../server/trendpick/context'
export const isArchivePath=(p:string)=>p==='/issues'||p.startsWith('/issue/')||p==='/api/issues'||p.startsWith('/api/issues/')||p==='/sitemap.xml'||p==='/sitemap-index.xml'||/^\/sitemap-issues-\d+\.xml$/.test(p)||p==='/sitemap-static.xml'||p==='/robots.txt'
const xml=(content:string)=>new Response(`<?xml version="1.0" encoding="UTF-8"?>${content}`,{headers:{'Content-Type':'application/xml; charset=utf-8'}})
export async function archiveResponse(request:Request,env:WorkerEnv){
 const url=new URL(request.url),path=url.pathname,origin=(env.SITE_URL||url.origin).replace(/\/$/,'')
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405})
 if(path==='/robots.txt')return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}})
 if(path==='/sitemap.xml'||path==='/sitemap-index.xml'){
  const count=await sitemapCount(env),pages=Math.ceil(count/500)
  return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${esc(origin)}/sitemap-static.xml</loc></sitemap>${Array.from({length:pages},(_,i)=>`<sitemap><loc>${esc(origin)}/sitemap-issues-${i+1}.xml</loc></sitemap>`).join('')}</sitemapindex>`)
 }
 if(path==='/sitemap-static.xml')return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/','/issues','/trending','/vs','/shopping','/about','/methodology'].map(p=>`<url><loc>${esc(origin+p)}</loc></url>`).join('')}</urlset>`)
 const match=path.match(/^\/sitemap-issues-(\d+)\.xml$/)
 if(match){const rows=await sitemapRows(env,archivePageNumber(match[1]));if(!rows.length)return new Response('Not found',{status:404});return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map(r=>`<url><loc>${esc(origin+issuePath(r.slug))}</loc><lastmod>${esc(r.updated_at)}</lastmod></url>`).join('')}</urlset>`)}
 if(path==='/issues'||path==='/api/issues'){
  const page=archivePageNumber(url.searchParams.get('page')),list=await issueList(env,page)
  if(path.startsWith('/api/'))return Response.json(list)
  return new Response(archiveDocument(`이슈 아카이브 | ${BRAND.name}`,'과거와 현재의 관심도 기록, 대표 뉴스와 관련 키워드를 확인하세요.',origin+'/issues'+(page>1?`?page=${page}`:''),listBody(list),list.data.length>0&&!mockMode(env)),{headers:{'Content-Type':'text/html; charset=utf-8'},status:page>1&&!list.data.length?404:200})
 }
 if(!/^\/(?:api\/)?issue(?:s)?\/[^/]+$/.test(path))return path.startsWith('/api/')?Response.json({error:'이슈를 찾을 수 없습니다.'},{status:404}):new Response('Not found',{status:404})
 const slug=decodeURIComponent(path.split('/').at(-1)??''),detail=await issueDetail(env,slug)
 if(path.startsWith('/api/'))return Response.json(detail??{error:'이슈를 찾을 수 없습니다.'},{status:detail?200:404})
 return new Response(archiveDocument(detail?issueTitle(detail.data):`이슈를 찾을 수 없습니다 | ${BRAND.name}`,detail?issueDescription(detail.data):'존재하지 않는 이슈입니다.',origin+issuePath(slug),detail?issueBody(detail):'<section class="archive-page"><h1>이슈를 찾을 수 없습니다.</h1><a href="/issues">이슈 목록 보기</a></section>',!!detail&&!mockMode(env)),{status:detail?200:404,headers:{'Content-Type':'text/html; charset=utf-8'}})
}
export async function cachedArchive(request:Request,env:WorkerEnv){
 const url=new URL(request.url);url.searchParams.set('_archiveMode',env.DATA_MODE??'mock');url.searchParams.set('_site',env.SITE_URL??'');url.searchParams.sort()
 const key=new Request(url),cache=caches.default
 if(request.method==='GET'){const hit=await cache.match(key);if(hit)return hit}
 const result=await archiveResponse(request,env),headers=new Headers(result.headers)
 headers.set('X-Content-Type-Options','nosniff');headers.set('Cache-Control',result.ok?'public, max-age=60, s-maxage=300':'no-store')
 const response=new Response(request.method==='HEAD'?null:result.body,{status:result.status,headers})
 if(result.ok&&request.method==='GET')await cache.put(key,response.clone())
 return response
}
