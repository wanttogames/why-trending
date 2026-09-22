import type { Keyword, TrendData, ContentResult, ContentItem } from '../../shared/types'
import type { Context } from './context'
import { SHOP_CATEGORIES } from '../../shared/config'
export const dateOnly=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)
export function range(days:number){const end=dateOnly(new Date(Date.now()-86_400_000));const start=new Date(`${end}T00:00:00Z`);start.setUTCDate(start.getUTCDate()-days+1);return {startDate:start.toISOString().slice(0,10),endDate:end}}
interface ResponseData { results:Array<{title:string;data:Array<{period:string;ratio:number}>}> }
export async function fetchTrend(ctx:Context,keys:Keyword[],days:number,shop?:string,filters:Record<string,unknown>={}):Promise<TrendData>{
 if(!keys.length||keys.length>5)throw new Error('1~5개 그룹만 허용됩니다.')
 const dates=range(days)
 const category=shop?SHOP_CATEGORIES.find(c=>c.id===shop):undefined
 if(shop&&!category)throw new Error('지원되지 않는 쇼핑 카테고리입니다.')
 const body=category?{...dates,timeUnit:'date',category:category.code,keyword:keys.map(k=>({name:k.keyword,param:[k.keyword]})),...filters}:{...dates,timeUnit:'date',keywordGroups:keys.map(k=>({groupName:k.keyword,keywords:[...new Set(k.aliases.length?k.aliases:[k.keyword])].slice(0,5)}))}
 const result=await ctx.client.request<ResponseData>(category?'/shopping/v1/category/keywords':'/search-trend/v1/search',{method:'POST',body})
 if(!Array.isArray(result.results))throw new Error('잘못된 NAVER 응답')
 const start=Date.parse(dates.startDate+'T00:00:00Z')
 return {...dates,source:category?'shopping':'search',category:shop,collectedAt:new Date().toISOString(),series:keys.map(k=>{
  const found=result.results.find(r=>r.title===k.keyword)
  const map=new Map((found?.data??[]).filter(p=>Number.isFinite(p.ratio)&&p.ratio>=0&&p.ratio<=100).map(p=>[p.period,p.ratio]))
  return {keyword:k.keyword,points:Array.from({length:days},(_,i)=>{const date=new Date(start+i*86_400_000).toISOString().slice(0,10);return {date,value:map.get(date)??null}})}
 })}
}
const clean=(s:string)=>s.replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
export async function fetchContent(ctx:Context,keyword:string):Promise<ContentResult>{
 const output:ContentResult={news:[],blog:[],cafe:[],unavailable:[]}
 for(const kind of ['news','blog','cafe'] as const){
  try{
   const q=new URLSearchParams({query:keyword,display:'5',sort:'date',format:'json'})
   const r=await ctx.client.request<{items:Array<{title:string;description:string;link:string;originallink?:string;pubDate?:string;postdate?:string;bloggername?:string;cafename?:string}>}>(`/search/v1/${kind==='cafe'?'cafearticle':kind}?${q}`,{retries:0})
   output[kind]=r.items.flatMap(item=>{
    const url=item.originallink||item.link;if(!/^https?:\/\//i.test(url))return []
    const source=item.bloggername||item.cafename||new URL(url).hostname
    const publishedAt=item.pubDate&&Number.isFinite(Date.parse(item.pubDate))?new Date(item.pubDate).toISOString():item.postdate&&/^\d{8}$/.test(item.postdate)?`${item.postdate.slice(0,4)}-${item.postdate.slice(4,6)}-${item.postdate.slice(6,8)}`:undefined
    return [{title:clean(item.title),description:clean(item.description??''),url,source:clean(source),...(publishedAt?{publishedAt}:{})} satisfies ContentItem]
   })
  }catch{output.unavailable.push(kind)}
 }
 if(output.unavailable.length===3)throw new Error('관련 콘텐츠를 가져오지 못했습니다.')
 return output
}
