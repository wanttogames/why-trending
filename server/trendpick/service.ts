import { InputError } from '../../shared/errors'
import type { WorkerEnv, Keyword, TrendData, Envelope, Ranking, Metrics } from '../../shared/types'
import { PERIODS, type Period, SHOP_CATEGORIES } from '../../shared/config'
import { normalize, token } from '../../shared/identity'
import { context, mockMode, type Context } from './context'
import { cached } from './cache'
import { fetchTrend,fetchContent } from './provider'
import { demo,demoKeys,mockRankings,mockTrend } from './mock'
export function periodOf(value:string|null,ranking=false):Period {const p=value??'7d';if(!(p in PERIODS)||(ranking&&p==='1y'))throw new InputError('지원되지 않는 기간입니다.');return p as Period}
export async function resolveKeyword(ctx:Context|null,value:string):Promise<Keyword>{
 const keyword=normalize(value)
 if(!ctx)return demoKeys.find(k=>k.keyword===keyword)??{keyword,slug:token(keyword),category:'전체',aliases:[keyword]}
 const {data,error}=await ctx.db.from('trend_keywords').select('*').eq('slug',token(keyword)).eq('enabled',true).maybeSingle()
 if(error)throw error
 if(data)return data as Keyword
 const {data:aliases,error:aliasError}=await ctx.db.from('trend_keywords').select('*').contains('aliases',[keyword]).eq('enabled',true).limit(2)
 if(aliasError)throw aliasError
 if(aliases?.length===1)return aliases[0] as Keyword
 return {keyword,slug:token(keyword),category:'전체',aliases:[keyword]}
}
export async function trend(env:WorkerEnv,values:string[],period:Period,shopping=false,filters:Record<string,string>={}):Promise<Envelope<TrendData>>{
 const ctx=mockMode(env)?null:context(env)
 const keys:Keyword[]=[];for(const v of values)keys.push(await resolveKeyword(ctx,v))
 keys.sort((a,b)=>a.keyword<b.keyword?-1:a.keyword>b.keyword?1:0)
 if(keys.length===2&&keys[0].keyword===keys[1].keyword)throw new InputError('같은 대상의 별칭입니다. 서로 다른 대상을 비교해 주세요.')
 const category=shopping?keys[0].shopping_category:undefined
 if(shopping&&(!category||!SHOP_CATEGORIES.some(c=>c.id===category)))throw new InputError('관리 목록에 등록된 쇼핑 키워드만 조회할 수 있습니다.')
 const bodyFilters:Record<string,unknown>={}
 if(filters.device){if(!['pc','mo'].includes(filters.device))throw new InputError('기기 필터 오류');bodyFilters.device=filters.device}
 if(filters.gender){if(!['m','f'].includes(filters.gender))throw new InputError('성별 필터 오류');bodyFilters.gender=filters.gender}
 if(filters.age){if(!['10','20','30','40','50','60'].includes(filters.age))throw new InputError('연령 필터 오류');bodyFilters.ages=[filters.age]}
 const days=Math.max(60,PERIODS[period]*2)
 if(!ctx)return demo({...mockTrend(keys,days,category??undefined),shoppingCategory:keys[0].shopping_category})
 const key=trendCacheKey(keys.map(k=>k.keyword),period,category??undefined,filters)
 return cached(ctx,key,shopping?7200:3600,async()=>{
  const result=await fetchTrend(ctx,keys,days,category??undefined,bodyFilters)
  if(result.series.every(s=>s.points.every(p=>p.value===null)))throw new Error('해당 기간의 관심도 데이터가 없습니다.')
  return {...result,shoppingCategory:keys[0].shopping_category}
 })
}
export const trendCacheKey=(values:string[],period:Period,category?:string,filters:Record<string,string>={})=>`trend:${category??'search'}:${JSON.stringify([...values].sort())}:${period}:${JSON.stringify(Object.entries(filters).filter(([,v])=>v).sort())}`
export async function rankings(env:WorkerEnv,period:Period,category:string,shop:boolean):Promise<Envelope<Ranking[]>>{
 if(mockMode(env))return demo(mockRankings(period,shop).filter(r=>!category||category==='전체'||(shop?r.keyword.shopping_category:r.keyword.category)===category))
 const ctx=context(env)
 let query=ctx.db.from('trend_rankings').select('metrics,recorded_at,source,trend_keywords!inner(*)').eq('source',shop?'shopping':'search').eq('period',period).eq('trend_keywords.enabled',true).gt('trend_score',0).order('trend_score',{ascending:false}).limit(100)
 if(category&&category!=='전체')query=query.eq(shop?'trend_keywords.shopping_category':'trend_keywords.category',category)
 const {data,error}=await query;if(error)throw error
 const items=(data??[]).map(row=>({keyword:row.trend_keywords as unknown as Keyword,metrics:row.metrics as Metrics,updatedAt:row.recorded_at as string,source:row.source as 'search'|'shopping'})).filter(r=>r.metrics.status!=='insufficient'&&(r.metrics.change??0)>0).slice(0,20)
 const updated=items.map(i=>i.updatedAt).sort()[0]??new Date().toISOString()
 const stale=items.some(r=>Date.now()-Date.parse(r.updatedAt)>7*3600000)
 return {data:items,meta:{mode:'real',updatedAt:updated,stale,...(stale?{message:'최근 업데이트 데이터를 표시하고 있습니다.'}:{})}}
}
export async function content(env:WorkerEnv,value:string){
 const keyword=normalize(value)
 if(mockMode(env))return demo({news:[],blog:[],cafe:[],unavailable:[]})
 const ctx=context(env)
 return cached(ctx,`content:${keyword}`,1800,()=>fetchContent(ctx,keyword))
}
